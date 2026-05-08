import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync } from './stripeClient';

let stripeInitialized = false;
let stripeInitPromise: Promise<void> | null = null;

export async function ensureStripeReady() {
  if (stripeInitialized) return;
  if (stripeInitPromise) return stripeInitPromise;

  stripeInitPromise = (async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.error('DATABASE_URL not set, skipping Stripe init');
      return;
    }

    try {
      console.log('Initializing Stripe schema...');
      await runMigrations({ databaseUrl });
      console.log('Stripe schema ready');

      const stripeSync = await getStripeSync();

      console.log('Setting up managed webhook...');
      try {
        const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
        const result = await stripeSync.findOrCreateManagedWebhook(
          `${webhookBaseUrl}/api/stripe/webhook`
        );
        console.log('Webhook configured:', result?.webhook?.url || 'ready');
      } catch (webhookErr) {
        console.warn('Webhook setup skipped (non-critical):', (webhookErr as any).message);
      }

      console.log('Syncing Stripe data...');
      stripeSync.syncBackfill()
        .then(() => console.log('Stripe data synced'))
        .catch((err: any) => console.error('Error syncing Stripe data:', err));

      stripeInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Stripe:', error);
      stripeInitPromise = null;
    }
  })();

  return stripeInitPromise;
}
