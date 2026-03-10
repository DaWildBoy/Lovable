import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InvoiceRequest {
  invoice_id: string;
  action: "send_email" | "download";
}

interface CompanySettings {
  company_name: string;
  company_address: string;
  company_email: string;
  company_phone: string;
  tax_registration_number: string;
  logo_url: string;
  invoice_footer_text: string;
  currency_code: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_email: string;
  courier_name: string;
  job_reference_id: string;
  pickup_location: string;
  dropoff_location: string;
  delivery_type: string;
  base_price: number;
  platform_fee: number;
  vat_amount: number;
  total_price: number;
  courier_earnings: number;
  detention_fee: number;
  return_fee: number;
  status: string;
  paid_at: string | null;
  created_at: string;
}

function formatCurrency(amount: number): string {
  return `TT$${Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function generateInvoiceHTML(
  invoice: Invoice,
  company: CompanySettings
): string {
  const logoBlock = company.logo_url
    ? `<img src="${company.logo_url}" alt="${company.company_name}" style="width:64px;height:64px;object-fit:contain;" />`
    : `<div style="width:64px;height:64px;background:#E8F4FD;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:bold;color:#0B7FD4;">${(company.company_name || "M")[0]}</div>`;

  const vatRow =
    invoice.vat_amount > 0
      ? `<tr>
      <td style="padding:12px 0;color:#6B7280;font-size:14px;">VAT</td>
      <td style="padding:12px 0;text-align:right;color:#374151;font-size:14px;">${formatCurrency(invoice.vat_amount)}</td>
    </tr>`
      : "";

  const detentionRow =
    (invoice.detention_fee || 0) > 0
      ? `<tr>
      <td style="padding:12px 0;">
        <p style="margin:0;font-size:14px;font-weight:600;color:#D97706;">Detention / Waiting Fee</p>
        <p style="margin:2px 0 0;font-size:12px;color:#6B7280;">Extended waiting time at pickup location</p>
      </td>
      <td style="padding:12px 0;text-align:right;font-size:14px;font-weight:600;color:#D97706;">${formatCurrency(invoice.detention_fee)}</td>
    </tr>`
      : "";

  const returnFeeRow =
    (invoice.return_fee || 0) > 0
      ? `<tr>
      <td style="padding:12px 0;">
        <p style="margin:0;font-size:14px;font-weight:600;color:#DC2626;">Reverse Logistics (Return to Base)</p>
        <p style="margin:2px 0 0;font-size:12px;color:#6B7280;">50% discounted return rate &mdash; Platform fees waived by MoveMeTT</p>
      </td>
      <td style="padding:12px 0;text-align:right;font-size:14px;font-weight:600;color:#DC2626;">+${formatCurrency(invoice.return_fee)}</td>
    </tr>`
      : "";

  const paidStamp =
    invoice.status === "paid"
      ? `<div style="text-align:center;padding:24px 0;">
      <div style="display:inline-block;border:3px solid #22C55E;border-radius:12px;padding:8px 24px;transform:rotate(-3deg);">
        <span style="font-size:28px;font-weight:900;color:#22C55E;letter-spacing:4px;text-transform:uppercase;">PAID</span>
      </div>
    </div>`
      : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; background: #f9fafb; color: #111827; }
    .invoice-container { max-width: 680px; margin: 0 auto; background: white; border-radius: 16px; padding: 48px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
    .company-info { display: flex; align-items: flex-start; gap: 16px; }
    .invoice-label { background: #E8F4FD; color: #0B7FD4; padding: 6px 16px; border-radius: 8px; font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; display: inline-block; margin-bottom: 8px; }
    .bill-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
    .bill-card { background: #f9fafb; border-radius: 12px; padding: 16px; }
    .bill-label { font-size: 10px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .delivery-box { background: #f9fafb; border-radius: 12px; padding: 16px; margin-bottom: 32px; }
    .location-row { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px; }
    .location-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 6px; flex-shrink: 0; }
    table { width: 100%; border-collapse: collapse; }
    thead th { text-align: left; font-size: 11px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 12px; border-bottom: 2px solid #E5E7EB; }
    thead th:last-child { text-align: right; }
    tbody td { border-bottom: 1px solid #F3F4F6; }
    tfoot td { padding-top: 16px; font-weight: 700; font-size: 16px; }
    .footer { border-top: 1px solid #E5E7EB; padding-top: 24px; margin-top: 24px; text-align: center; }
    .footer-text { font-style: italic; color: #6B7280; font-size: 14px; margin-bottom: 12px; }
    .footer-contact { color: #9CA3AF; font-size: 12px; }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div class="company-info">
        ${logoBlock}
        <div>
          <h1 style="margin:0;font-size:20px;font-weight:700;color:#111827;">${company.company_name || "MoveMe TT"}</h1>
          ${company.company_address ? `<p style="margin:4px 0 0;font-size:13px;color:#6B7280;max-width:260px;line-height:1.5;white-space:pre-line;">${company.company_address}</p>` : ""}
          ${company.company_email ? `<p style="margin:2px 0 0;font-size:13px;color:#6B7280;">${company.company_email}</p>` : ""}
          ${company.company_phone ? `<p style="margin:2px 0 0;font-size:13px;color:#6B7280;">${company.company_phone}</p>` : ""}
          ${company.tax_registration_number ? `<p style="margin:4px 0 0;font-size:11px;color:#9CA3AF;">Tax Reg: ${company.tax_registration_number}</p>` : ""}
        </div>
      </div>
      <div style="text-align:right;">
        <div class="invoice-label">Invoice</div>
        <p style="margin:0;font-size:18px;font-weight:700;color:#111827;">${invoice.invoice_number}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#6B7280;">Date: ${formatDate(invoice.created_at)}</p>
        ${invoice.paid_at ? `<p style="margin:2px 0 0;font-size:13px;color:#22C55E;font-weight:600;">Paid: ${formatDate(invoice.paid_at)}</p>` : ""}
      </div>
    </div>

    <div class="bill-grid">
      <div class="bill-card">
        <div class="bill-label">Bill To</div>
        <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">${invoice.customer_name}</p>
        <p style="margin:2px 0 0;font-size:13px;color:#6B7280;">${invoice.customer_email}</p>
      </div>
      <div class="bill-card">
        <div class="bill-label">Delivered By</div>
        <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">${invoice.courier_name || "Unassigned"}</p>
        <p style="margin:2px 0 0;font-size:13px;color:#6B7280;">${invoice.delivery_type || "Standard"} Delivery</p>
      </div>
    </div>

    <div class="delivery-box">
      <div class="bill-label" style="margin-bottom:12px;">Delivery Details</div>
      <div class="location-row">
        <div class="location-dot" style="background:#22C55E;"></div>
        <div>
          <p style="margin:0;font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;">Pickup</p>
          <p style="margin:2px 0 0;font-size:13px;color:#374151;">${invoice.pickup_location || "N/A"}</p>
        </div>
      </div>
      <div class="location-row">
        <div class="location-dot" style="background:#EF4444;"></div>
        <div>
          <p style="margin:0;font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;">Drop-off</p>
          <p style="margin:2px 0 0;font-size:13px;color:#374151;">${invoice.dropoff_location || "N/A"}</p>
        </div>
      </div>
      <p style="margin:12px 0 0;padding-top:8px;border-top:1px solid #E5E7EB;font-size:12px;color:#9CA3AF;">
        Job Ref: ${invoice.job_reference_id || "N/A"}
      </p>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:16px 0;">
            <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">Delivery Service</p>
            <p style="margin:2px 0 0;font-size:12px;color:#6B7280;">${invoice.pickup_location ? `${invoice.pickup_location.split(",")[0]} to ${(invoice.dropoff_location || "").split(",")[0]}` : "Delivery service"}</p>
          </td>
          <td style="padding:16px 0;text-align:right;font-size:14px;font-weight:600;color:#111827;">${formatCurrency(invoice.base_price)}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;color:#6B7280;font-size:14px;">Platform Fee</td>
          <td style="padding:12px 0;text-align:right;color:#374151;font-size:14px;">${formatCurrency(invoice.platform_fee)}</td>
        </tr>
        ${vatRow}
        ${detentionRow}
        ${returnFeeRow}
      </tbody>
      <tfoot>
        <tr>
          <td style="border-top:2px solid #E5E7EB;">Total Due</td>
          <td style="border-top:2px solid #E5E7EB;text-align:right;font-size:18px;">${formatCurrency(invoice.total_price)}</td>
        </tr>
      </tfoot>
    </table>

    ${paidStamp}

    <div class="footer">
      ${company.invoice_footer_text ? `<p class="footer-text">${company.invoice_footer_text}</p>` : ""}
      <p class="footer-contact">
        ${[company.company_email, company.company_phone, company.tax_registration_number ? `Tax Reg: ${company.tax_registration_number}` : ""].filter(Boolean).join(" | ")}
      </p>
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: userError } = await authClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { invoice_id, action }: InvoiceRequest = await req.json();

    if (!invoice_id) {
      return new Response(
        JSON.stringify({ error: "invoice_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoice_id)
      .maybeSingle();

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: company } = await supabase
      .from("company_settings")
      .select(
        "company_name, company_address, company_email, company_phone, tax_registration_number, logo_url, invoice_footer_text, currency_code"
      )
      .maybeSingle();

    const companySettings: CompanySettings = company || {
      company_name: "MoveMe TT",
      company_address: "",
      company_email: "",
      company_phone: "",
      tax_registration_number: "",
      logo_url: "",
      invoice_footer_text: "Thank you for using MoveMe TT!",
      currency_code: "TTD",
    };

    const html = generateInvoiceHTML(invoice as Invoice, companySettings);

    if (action === "download") {
      return new Response(html, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="${invoice.invoice_number}.html"`,
        },
      });
    }

    if (action === "send_email") {
      console.log("=== Invoice Email ===");
      console.log("To:", invoice.customer_email);
      console.log("Invoice:", invoice.invoice_number);
      console.log("Amount:", formatCurrency(invoice.total_price));
      console.log("HTML Length:", html.length);
      console.log("=====================");

      await supabase
        .from("invoices")
        .update({
          status: invoice.status === "draft" ? "sent" : invoice.status,
          email_sent: true,
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoice_id);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Invoice email prepared for ${invoice.customer_email}`,
          html_preview: html.substring(0, 200),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "send_email" or "download"' }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Invoice generation error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
