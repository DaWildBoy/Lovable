import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { notification_id } = await req.json();

    if (!notification_id) {
      throw new Error("notification_id is required");
    }

    // Get notification details
    const { data: notification, error: notifError } = await supabase
      .from("notifications")
      .select("*, user:user_id(email, raw_user_meta_data)")
      .eq("id", notification_id)
      .single();

    if (notifError || !notification) {
      throw new Error("Notification not found");
    }

    // Get user email and name
    const userEmail = notification.user?.email;
    const userName = notification.user?.raw_user_meta_data?.full_name || "User";

    if (!userEmail) {
      console.log("No email found for user, skipping email notification");
      return new Response(
        JSON.stringify({ success: true, message: "No email to send" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log email notification (email integration not configured yet)
    console.log("=== Email Notification ===");
    console.log("To:", userEmail);
    console.log("Name:", userName);
    console.log("Subject:", notification.title);
    console.log("Message:", notification.message);
    console.log("Type:", notification.type);
    console.log("Data:", JSON.stringify(notification.data));
    console.log("========================");

    // TODO: Integrate with email service like Resend, SendGrid, or AWS SES
    // Configure your email service API key and add integration code here

    // Update notification as email sent
    await supabase
      .from("notifications")
      .update({
        email_sent: true,
        email_sent_at: new Date().toISOString(),
      })
      .eq("id", notification_id);

    // Send push notification (implement when mobile app is ready)
    // This would integrate with Firebase Cloud Messaging or similar service

    return new Response(
      JSON.stringify({
        success: true,
        message: "Notification processed successfully",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error processing notification:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
