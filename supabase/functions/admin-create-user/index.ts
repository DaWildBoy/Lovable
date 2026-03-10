import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: jsonHeaders }
      );
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user: caller },
    } = await userClient.auth.getUser();
    if (!caller) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: jsonHeaders }
      );
    }

    const { data: callerProfile } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .maybeSingle();

    const callerRole = callerProfile?.role;
    const canCreate = callerRole === "super_admin" || callerRole === "support_admin";
    if (!canCreate) {
      return new Response(
        JSON.stringify({ error: "Forbidden: admin access required" }),
        { status: 403, headers: jsonHeaders }
      );
    }

    const { email, password, firstName, lastName, phone, role } =
      await req.json();

    if (!email || !password || !role) {
      return new Response(
        JSON.stringify({ error: "email, password, and role are required" }),
        { status: 400, headers: jsonHeaders }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const adminOnlyRoles = ["super_admin", "support_admin", "verification_admin"];
    if (callerRole !== "super_admin" && adminOnlyRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: "Only super admins can create admin accounts" }),
        { status: 403, headers: jsonHeaders }
      );
    }

    const validRoles = [
      "customer",
      "courier",
      "business",
      "super_admin",
      "support_admin",
      "verification_admin",
    ];
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: newUser, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (createError) {
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const fullName = [firstName, lastName].filter(Boolean).join(" ") || null;

    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert({
        id: newUser.user.id,
        role,
        email,
        first_name: firstName || null,
        last_name: lastName || null,
        full_name: fullName,
        phone: phone || null,
      }, { onConflict: "id" });

    if (profileError) {
      return new Response(
        JSON.stringify({
          error: `User created but profile insert failed: ${profileError.message}`,
        }),
        { status: 500, headers: jsonHeaders }
      );
    }

    if (role === "courier") {
      await adminClient.from("couriers").insert({
        user_id: newUser.user.id,
        verified: false,
        verification_status: "pending",
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId: newUser.user.id,
      }),
      { headers: jsonHeaders }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: jsonHeaders }
    );
  }
});
