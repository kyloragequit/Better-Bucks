import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { storage } from './storage';
import type Stripe from 'stripe';

async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text?: string }): Promise<void> {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (!smtpUser || !smtpPass) return;
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = parseInt(process.env.SMTP_PORT || "587");
  const nm = await import("nodemailer");
  const transporter = nm.default.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });
  await transporter.sendMail({
    from: `"Better Bucks" <${smtpUser}>`,
    to, subject, html, ...(text ? { text } : {}),
  });
  console.log(`[Email] Sent "${subject}" to ${to.replace(/(.{2}).*(@.*)/, "$1***$2")}`);
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function fmtCents(cents: number): string {
  return "$" + (cents / 100).toFixed(2);
}

const EMAIL_LOGO_URL = "https://betterbucks.net/logo.png";
const emailLogoHeader = `<div style="text-align:center;padding:20px 0 12px;"><img src="${EMAIL_LOGO_URL}" alt="Better Bucks" width="64" height="64" style="display:block;margin:0 auto;" /></div>`;

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  try {
    if (!invoice.customer || invoice.amount_paid === 0) return;

    const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer.id;

    const allOrgs = await storage.getAllOrganizations();
    const org = allOrgs.find(o => o.stripeCustomerId === customerId);
    if (!org) {
      console.log(`[Webhook] invoice.paid — no org found for customer ${customerId}`);
      return;
    }

    const orgUsers = await storage.getUsersByOrganization(org.id);
    const primeAdmins = orgUsers.filter(u => u.role === "prime_admin" && u.email);
    if (primeAdmins.length === 0) {
      console.log(`[Webhook] invoice.paid — no prime admin emails for org ${org.id}`);
      return;
    }

    const stripe = await getUncachableStripeClient();

    let paymentMethodDesc = "Card on file";
    if (invoice.payment_intent) {
      try {
        const piId = typeof invoice.payment_intent === "string" ? invoice.payment_intent : invoice.payment_intent.id;
        const pi = await stripe.paymentIntents.retrieve(piId);
        if (pi.payment_method) {
          const pmId = typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method.id;
          const pm = await stripe.paymentMethods.retrieve(pmId);
          if (pm.card) {
            paymentMethodDesc = `${pm.card.brand?.toUpperCase() || "Card"} •••• ${pm.card.last4}`;
          }
        }
      } catch {}
    }

    const subtotal = invoice.subtotal || 0;
    const tax = invoice.tax || 0;
    const total = invoice.amount_paid || 0;
    const planName = invoice.lines?.data?.[0]?.description || `Better Bucks – ${org.tier || "Subscription"}`;
    const periodStart = invoice.lines?.data?.[0]?.period?.start ? fmtDate(invoice.lines.data[0].period.start) : "—";
    const periodEnd = invoice.lines?.data?.[0]?.period?.end ? fmtDate(invoice.lines.data[0].period.end) : "—";
    const invoiceDate = invoice.created ? fmtDate(invoice.created) : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const invoiceNumber = invoice.number || `INV-${invoice.id?.slice(-8) || "unknown"}`;
    const isTrialEnd = invoice.billing_reason === "subscription_create" || invoice.billing_reason === "subscription_cycle" && !!(invoice as any).subscription_details?.trial_end;

    let taxLabel = "Tax";
    if (invoice.total_tax_amounts && invoice.total_tax_amounts.length > 0) {
      const taxRate = invoice.total_tax_amounts[0].tax_rate;
      if (typeof taxRate !== "string" && taxRate.display_name) {
        taxLabel = taxRate.display_name;
        if (taxRate.percentage) taxLabel += ` (${taxRate.percentage}%)`;
      }
    }

    const trialBanner = isTrialEnd
      ? `<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;margin-bottom:20px;text-align:center;">
          <p style="margin:0;font-size:14px;color:#92400e;font-weight:600;">🎉 Your free trial has ended — your subscription is now active!</p>
        </div>`
      : "";

    const pdfButton = invoice.invoice_pdf
      ? `<div style="text-align:center;margin-top:20px;">
          <a href="${invoice.invoice_pdf}" style="display:inline-block;background:#162A4A;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Download Invoice PDF</a>
        </div>`
      : "";

    const html = `
      <div style="font-family:'Inter',Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#ffffff;">
        ${emailLogoHeader}
        
        <h2 style="text-align:center;color:#162A4A;font-size:22px;font-weight:700;margin:16px 0 4px;">Payment Receipt</h2>
        <p style="text-align:center;color:#64748b;font-size:13px;margin:0 0 24px;">Invoice #${esc(invoiceNumber)} • ${esc(invoiceDate)}</p>

        ${trialBanner}

        <div style="background:#F0F4F8;border-radius:12px;padding:20px;margin-bottom:20px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:6px 0;color:#64748b;font-size:13px;">Organization</td>
              <td style="padding:6px 0;text-align:right;font-weight:600;color:#162A4A;font-size:13px;">${esc(org.name)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#64748b;font-size:13px;">Plan</td>
              <td style="padding:6px 0;text-align:right;font-weight:600;color:#162A4A;font-size:13px;">${esc(planName)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#64748b;font-size:13px;">Billing Period</td>
              <td style="padding:6px 0;text-align:right;font-weight:600;color:#162A4A;font-size:13px;">${esc(periodStart)} — ${esc(periodEnd)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#64748b;font-size:13px;">Payment Method</td>
              <td style="padding:6px 0;text-align:right;font-weight:600;color:#162A4A;font-size:13px;">${esc(paymentMethodDesc)}</td>
            </tr>
          </table>
        </div>

        <div style="background:#ffffff;border:1px solid #dde3ea;border-radius:12px;padding:20px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:8px 0;color:#162A4A;font-size:14px;">${esc(planName)}</td>
              <td style="padding:8px 0;text-align:right;color:#162A4A;font-size:14px;">${fmtCents(subtotal)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#64748b;font-size:13px;">${esc(taxLabel)}</td>
              <td style="padding:8px 0;text-align:right;color:#64748b;font-size:13px;">${fmtCents(tax)}</td>
            </tr>
            <tr>
              <td colspan="2" style="border-top:1px solid #dde3ea;padding:0;"></td>
            </tr>
            <tr>
              <td style="padding:12px 0 4px;color:#162A4A;font-size:16px;font-weight:700;">Total Charged</td>
              <td style="padding:12px 0 4px;text-align:right;color:#4E9F3D;font-size:20px;font-weight:700;">${fmtCents(total)}</td>
            </tr>
          </table>
        </div>

        ${pdfButton}

        <div style="margin-top:24px;padding-top:20px;border-top:1px solid #dde3ea;text-align:center;">
          <p style="color:#64748b;font-size:12px;margin:0 0 4px;">Questions about your bill? Reply to this email or contact us at</p>
          <p style="margin:0;"><a href="mailto:support@betterbucks.net" style="color:#4E9F3D;font-size:12px;text-decoration:none;">support@betterbucks.net</a></p>
          <p style="color:#94a3b8;font-size:11px;margin:12px 0 0;">Better Bucks, LLC — Employee Incentive Platform</p>
        </div>
      </div>
    `;

    const text = `Better Bucks — Payment Receipt\n\nInvoice: ${invoiceNumber}\nDate: ${invoiceDate}\nOrganization: ${org.name}\nPlan: ${planName}\nPeriod: ${periodStart} — ${periodEnd}\nSubtotal: ${fmtCents(subtotal)}\nTax: ${fmtCents(tax)}\nTotal Charged: ${fmtCents(total)}\nPayment: ${paymentMethodDesc}\n\nQuestions? Contact support@betterbucks.net`;

    for (const admin of primeAdmins) {
      await sendEmail({
        to: admin.email!,
        subject: `Better Bucks — Payment Receipt (${invoiceDate})`,
        html,
        text,
      }).catch(err => console.error(`[Webhook] Failed to send billing email to admin ${admin.id}:`, err));
    }

    console.log(`[Webhook] invoice.paid — sent billing receipt to ${primeAdmins.length} admin(s) for org ${org.id}`);
  } catch (err) {
    console.error("[Webhook] Error handling invoice.paid:", err);
  }
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    try {
      const stripe = await getUncachableStripeClient();
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (webhookSecret) {
        const event = stripe.webhooks.constructEvent(payload.toString(), signature, webhookSecret);
        if (event.type === "invoice.paid") {
          await handleInvoicePaid(event.data.object as Stripe.Invoice);
        }
      } else {
        const parsed = JSON.parse(payload.toString());
        if (parsed.type === "invoice.paid" && parsed.data?.object) {
          await handleInvoicePaid(parsed.data.object as Stripe.Invoice);
        }
      }
    } catch (err) {
      console.error("[Webhook] Custom event processing error (non-fatal):", err);
    }
  }
}

export { handleInvoicePaid };
