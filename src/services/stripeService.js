import Stripe from 'stripe';
import prisma from '../../prisma/client.js';
import { getPlanLimits } from '../config/planLimits.js';

// Initialize Stripe only if API key is provided
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
} else {
  console.warn('⚠️  STRIPE_SECRET_KEY not configured - Stripe features will be disabled');
}

/**
 * Check if Stripe is configured
 */
function ensureStripeConfigured() {
  if (!stripe) {
    throw new Error('Stripe is not configured. Please add STRIPE_SECRET_KEY to your environment variables.');
  }
}

/**
 * Stripe Service
 * Handles all Stripe-related operations for billing
 */

/**
 * Create or retrieve Stripe customer
 * @param {string} companyId - Company ID
 * @param {string} email - Customer email
 * @param {string} name - Customer name
 * @returns {Promise<object>} Stripe customer
 */
export async function getOrCreateCustomer(companyId, email, name) {
  ensureStripeConfigured();

  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      throw new Error('Company not found');
    }

    // If customer already exists, return it
    if (company.stripeCustomerId) {
      const customer = await stripe.customers.retrieve(company.stripeCustomerId);
      return customer;
    }

    // Create new Stripe customer
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        companyId,
      },
    });

    // Save customer ID to database
    await prisma.company.update({
      where: { id: companyId },
      data: {
        stripeCustomerId: customer.id
      }
    });

    console.log(`✅ Created Stripe customer: ${customer.id} for company ${companyId}`);

    return customer;
  } catch (error) {
    console.error('Error getting/creating Stripe customer:', error);
    throw error;
  }
}

/**
 * Create checkout session for plan subscription
 * @param {string} companyId - Company ID
 * @param {string} planName - Plan name (Starter, Professional, Enterprise)
 * @param {string} billingCycle - monthly or yearly
 * @param {string} successUrl - Success redirect URL
 * @param {string} cancelUrl - Cancel redirect URL
 * @returns {Promise<object>} Checkout session
 */
export async function createSubscriptionCheckout(companyId, planName, billingCycle, successUrl, cancelUrl) {
  ensureStripeConfigured();

  try {
    console.log(`Creating subscription checkout for company: ${companyId}, plan: ${planName}`);

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { adminUser: true }
    });

    if (!company) {
      throw new Error('Company not found');
    }

    console.log(`Company found: ${company.name}, adminEmail: ${company.adminEmail}`);

    const planLimits = getPlanLimits(planName);

    if (!planLimits.price) {
      throw new Error('Invalid plan or custom pricing required');
    }

    // Use company's adminEmail if available, otherwise fallback to adminUser email
    const customerEmail = company.adminEmail || company.adminUser?.email || 'noemail@example.com';
    const customerName = company.name;

    console.log(`Getting or creating Stripe customer with email: ${customerEmail}`);

    // Get or create Stripe customer
    const customer = await getOrCreateCustomer(
      companyId,
      customerEmail,
      customerName
    );

    // Determine price based on billing cycle
    const priceAmount = billingCycle === 'yearly'
      ? planLimits.yearlyPrice
      : planLimits.price;

    // Create or get the price in Stripe
    // Note: In production, you should create these prices in Stripe Dashboard
    // and reference them by ID
    const price = await stripe.prices.create({
      unit_amount: priceAmount * 100, // Convert to cents
      currency: 'usd',
      recurring: {
        interval: billingCycle === 'yearly' ? 'year' : 'month',
      },
      product_data: {
        name: `${planName} Plan`,
      },
    });

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: 'subscription',
      line_items: [
        {
          price: price.id,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        companyId,
        planName,
        billingCycle,
      },
    });

    console.log(`✅ Created checkout session: ${session.id} for ${planName} plan`);

    return session;
  } catch (error) {
    console.error('Error creating subscription checkout:', error);
    throw error;
  }
}

/**
 * Create checkout session for credit purchase
 * @param {string} companyId - Company ID
 * @param {number} dollarAmount - Amount in dollars
 * @param {string} successUrl - Success redirect URL
 * @param {string} cancelUrl - Cancel redirect URL
 * @returns {Promise<object>} Checkout session
 */
export async function createCreditPurchaseCheckout(companyId, dollarAmount, successUrl, cancelUrl) {
  ensureStripeConfigured();

  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { adminUser: true }
    });

    if (!company) {
      throw new Error('Company not found');
    }

    // Get or create Stripe customer
    const customer = await getOrCreateCustomer(
      companyId,
      company.adminUser.email,
      company.name
    );

    const creditsAmount = dollarAmount * 8; // $1 = 8 credits

    // Create checkout session for one-time payment
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${creditsAmount} AI Credits`,
              description: `Purchase ${creditsAmount} AI credits for document processing`,
            },
            unit_amount: dollarAmount * 100, // Convert to cents
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        companyId,
        type: 'credit_purchase',
        dollarAmount: dollarAmount.toString(),
        creditsAmount: creditsAmount.toString(),
      },
    });

    console.log(`✅ Created credit purchase session: ${session.id} for $${dollarAmount}`);

    return session;
  } catch (error) {
    console.error('Error creating credit purchase checkout:', error);
    throw error;
  }
}

/**
 * Cancel subscription
 * @param {string} subscriptionId - Stripe subscription ID
 * @returns {Promise<object>} Cancelled subscription
 */
export async function cancelSubscription(subscriptionId) {
  ensureStripeConfigured();

  try {
    const subscription = await stripe.subscriptions.cancel(subscriptionId);

    console.log(`✅ Cancelled subscription: ${subscriptionId}`);

    return subscription;
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    throw error;
  }
}

/**
 * Update subscription (change plan)
 * @param {string} subscriptionId - Stripe subscription ID
 * @param {string} newPriceId - New Stripe price ID
 * @returns {Promise<object>} Updated subscription
 */
export async function updateSubscription(subscriptionId, newPriceId) {
  ensureStripeConfigured();

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: newPriceId,
        },
      ],
      proration_behavior: 'none', // No proration as per requirements
    });

    console.log(`✅ Updated subscription: ${subscriptionId} to price ${newPriceId}`);

    return updatedSubscription;
  } catch (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }
}

/**
 * Get subscription details
 * @param {string} subscriptionId - Stripe subscription ID
 * @returns {Promise<object>} Subscription
 */
export async function getSubscription(subscriptionId) {
  ensureStripeConfigured();

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return subscription;
  } catch (error) {
    console.error('Error fetching subscription:', error);
    throw error;
  }
}

/**
 * Create billing portal session (for managing payment methods)
 * @param {string} customerId - Stripe customer ID
 * @param {string} returnUrl - Return URL after portal session
 * @returns {Promise<object>} Portal session
 */
export async function createBillingPortalSession(customerId, returnUrl) {
  ensureStripeConfigured();

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    console.log(`✅ Created billing portal session for customer ${customerId}`);

    return session;
  } catch (error) {
    console.error('Error creating billing portal session:', error);
    throw error;
  }
}

/**
 * Construct webhook event from request
 * @param {Buffer} payload - Request body
 * @param {string} signature - Stripe signature header
 * @returns {object} Stripe event
 */
export function constructWebhookEvent(payload, signature) {
  ensureStripeConfigured();

  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET not configured');
    }

    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret
    );

    return event;
  } catch (error) {
    console.error('Error constructing webhook event:', error);
    throw error;
  }
}

export default {
  getOrCreateCustomer,
  createSubscriptionCheckout,
  createCreditPurchaseCheckout,
  cancelSubscription,
  updateSubscription,
  getSubscription,
  createBillingPortalSession,
  constructWebhookEvent,
};
