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
        { status: 401, headers: jsonHeaders },
      );
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user: caller },
    } = await userClient.auth.getUser();
    if (!caller) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: jsonHeaders },
      );
    }

    const { data: callerProfile } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .maybeSingle();

    const callerRole = callerProfile?.role;
    if (callerRole !== "super_admin" && callerRole !== "support_admin") {
      return new Response(
        JSON.stringify({ error: "Forbidden: admin access required" }),
        { status: 403, headers: jsonHeaders },
      );
    }

    const { title, message, type, targetAudience } = await req.json();

    if (!title || !message) {
      return new Response(
        JSON.stringify({ error: "title and message are required" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const validTypes = [
      "announcement",
      "promo",
      "traffic_alert",
      "platform_update",
      "system_announcement",
    ];
    const notifType = validTypes.includes(type) ? type : "announcement";
    const audience = targetAudience || "all";

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let query = adminClient.from("profiles").select("id");
    if (audience === "customers") {
      query = query.eq("role", "customer");
    } else if (audience === "couriers") {
      query = query.eq("role", "courier");
    } else if (audience === "businesses") {
      query = query.eq("role", "business");
    }

    const { data: users, error: usersError } = await query;

    if (usersError) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch users: ${usersError.message}` }),
        { status: 500, headers: jsonHeaders },
      );
    }

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ error: "No users found for the target audience" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const BATCH_SIZE = 500;
    let inserted = 0;

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      const notifications = batch.map((user: { id: string }) => ({
        user_id: user.id,
        type: notifType,
        title,
        message,
        data: { broadcast: true, admin_id: caller.id },
        read: false,
      }));

      const { error: insertError } = await adminClient
        .from("notifications")
        .insert(notifications);

      if (insertError) {
        console.error(`Batch insert error at offset ${i}:`, insertError);
      } else {
        inserted += batch.length;
      }
    }

    const { error: broadcastError } = await adminClient
      .from("broadcast_notifications")
      .insert({
        admin_id: caller.id,
        title,
        message,
        type: notifType,
        target_audience: audience,
        recipients_count: inserted,
      });

    if (broadcastError) {
      console.error("Failed to log broadcast:", broadcastError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        recipientsCount: inserted,
        totalUsers: users.length,
      }),
      { headers: jsonHeaders },
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
