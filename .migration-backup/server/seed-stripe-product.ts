import { getUncachableStripeClient } from './stripeClient';

async function seedProducts() {
  const stripe = await getUncachableStripeClient();

  const products = await stripe.products.search({ query: "name:'Employee Incentive Portal'" });
  if (products.data.length > 0) {
    console.log('Product already exists:', products.data[0].id);
    const prices = await stripe.prices.list({ product: products.data[0].id, active: true });
    console.log('Existing price:', prices.data[0]?.id);
    return;
  }

  const product = await stripe.products.create({
    name: 'Employee Incentive Portal',
    description: 'Monthly subscription for the Employee Incentive & Rewards Management Portal. Manage employee points, rewards, orders, and team administration.',
  });

  const monthlyPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 5000,
    currency: 'usd',
    recurring: { interval: 'month' },
  });

  console.log('Created product:', product.id);
  console.log('Created monthly price ($50/mo):', monthlyPrice.id);
}

seedProducts().catch(console.error);
