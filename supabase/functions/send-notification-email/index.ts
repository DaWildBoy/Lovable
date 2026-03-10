import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface NotificationPayload {
  user_email: string;
  user_name: string;
  title: string;
  message: string;
  notification_type: string;
  data?: Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const payload: NotificationPayload = await req.json();
    const { user_email, user_name, title, message, notification_type, data } = payload;

    // In production, integrate with email service like Resend, SendGrid, or AWS SES
    // For now, we'll log the notification and return success
    console.log("=== Email Notification ===");
    console.log("To:", user_email);
    console.log("Name:", user_name);
    console.log("Subject:", title);
    console.log("Message:", message);
    console.log("Type:", notification_type);
    console.log("Data:", JSON.stringify(data));
    console.log("========================");

    // TODO: Integrate with email service like Resend, SendGrid, or AWS SES
    // Configure your email service API key and uncomment the integration code

    return new Response(
      JSON.stringify({
        success: true,
        message: "Notification email logged successfully",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error sending notification email:", error);
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
