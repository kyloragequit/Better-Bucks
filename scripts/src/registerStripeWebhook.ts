/**
 * registerStripeWebhook.ts
 *
 * One-time setup script: registers the Better Bucks webhook endpoint in Stripe
 * and prints the signing secret that must be saved as STRIPE_WEBHOOK_SECRET.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_live_... pnpm --filter @workspace/scripts run register-stripe-webhook
 *
 * The script is idempotent — if an endpoint already exists for the target URL
 * it is updated in-place (events list is synced) rather than duplicated.
 */

import Stripe from "stripe";

const WEBHOOK_URL = "https://betterbucks.net/api/stripe/webhook";

const REQUIRED_EVENTS: Stripe.WebhookEndpointUpdateParams.EnabledEvent[] = [
  "invoice.created",
  "invoice.paid",
  "customer.subscription.updated",
  "customer.subscription.deleted",
];

async function main(): Promise<void> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error("ERROR: STRIPE_SECRET_KEY environment variable is not set.");
    console.error(
      "Usage: STRIPE_SECRET_KEY=sk_... pnpm --filter @workspace/scripts run register-stripe-webhook",
    );
    process.exit(1);
  }

  const stripe = new Stripe(secretKey);

  console.log(`\nRegistering Stripe webhook for: ${WEBHOOK_URL}`);
  console.log(`Events: ${REQUIRED_EVENTS.join(", ")}\n`);

  const existing = await stripe.webhookEndpoints.list({ limit: 100 });
  const match = existing.data.find((ep) => ep.url === WEBHOOK_URL);

  let endpoint: Stripe.WebhookEndpoint;

  if (match) {
    console.log(`Found existing endpoint ${match.id} — updating events list...`);
    endpoint = await stripe.webhookEndpoints.update(match.id, {
      enabled_events: REQUIRED_EVENTS,
      disabled: false,
    } as Stripe.WebhookEndpointUpdateParams);
    console.log("Endpoint updated.");
    if (!endpoint.secret) {
      console.warn(
        "\nWARNING: Stripe does not re-expose the signing secret after creation.",
      );
      console.warn(
        "If you need to rotate it, delete the endpoint in the Stripe Dashboard and re-run this script.",
      );
    }
  } else {
    console.log("No existing endpoint found — creating new one...");
    endpoint = await stripe.webhookEndpoints.create({
      url: WEBHOOK_URL,
      enabled_events: REQUIRED_EVENTS,
      description: "Better Bucks — payment and subscription events",
    });
    console.log(`Endpoint created: ${endpoint.id}`);
  }

  console.log("\n--- Stripe Webhook Endpoint ---");
  console.log(`ID:     ${endpoint.id}`);
  console.log(`URL:    ${endpoint.url}`);
  console.log(`Status: ${endpoint.status}`);
  console.log(`Events: ${endpoint.enabled_events.join(", ")}`);

  if (endpoint.secret) {
    console.log("\n--- Action Required ---");
    console.log("Save the following as the STRIPE_WEBHOOK_SECRET secret in Replit:");
    console.log(`\n  ${endpoint.secret}\n`);
    console.log(
      "In the Replit UI: open the Secrets tab and set STRIPE_WEBHOOK_SECRET to the value above.",
    );
  } else {
    console.log(
      "\nThe signing secret was already saved from when the endpoint was first created.",
    );
    console.log(
      "Ensure STRIPE_WEBHOOK_SECRET in Replit matches the secret shown in the Stripe Dashboard",
    );
    console.log(`for endpoint ${endpoint.id}.`);
  }

  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
