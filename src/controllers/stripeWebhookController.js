import { PrismaClient } from '@prisma/client';
import { constructWebhookEvent } from '../services/stripeService.js';
import { upgradePlan, purchaseCredits, refillCredits } from '../services/billingService.js';

const prisma = new PrismaClient();

/**
 * Handle Stripe Webhook Events
 * POST /api/stripe-webhook
 */
export const handleStripeWebhook = async (req, res) => {
  const signature = req.headers['stripe-signature'];

  try {
    // Construct and verify the event
    const event = constructWebhookEvent(req.body, signature);

    console.log(`🔔 Stripe webhook received: ${event.type}`);

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(400).json({ error: `Webhook Error: ${error.message}` });
  }
};

/**
 * Handle checkout session completed
 * This is called when a payment is successful (subscription or one-time)
 */
async function handleCheckoutCompleted(session) {
  console.log('📦 Checkout session metadata:', session.metadata);

  const { companyId, planName, billingCycle, type, dollarAmount, creditsAmount } =
    session.metadata;

  console.log(`🔍 Processing checkout - Type: ${type}, Plan: ${planName}, Company: ${companyId}`);

  if (type === 'credit_purchase') {
    // Handle credit purchase
    console.log(`💰 Handling credit purchase for $${dollarAmount}`);
    await handleCreditPurchase(companyId, parseInt(dollarAmount));
  } else if (planName) {
    // Handle subscription creation
    console.log(`📋 Handling plan upgrade to ${planName}`);
    await handleSubscriptionCheckout(companyId, planName, billingCycle, session);
  } else {
    console.warn('⚠️ Checkout completed but no type or planName in metadata!');
    console.warn('Session:', JSON.stringify(session, null, 2));
  }
}

/**
 * Handle credit purchase from checkout
 */
async function handleCreditPurchase(companyId, dollarAmount) {
  try {
    const result = await purchaseCredits(companyId, dollarAmount);

    // Create billing history record for credit purchase
    await prisma.billingHistory.create({
      data: {
        companyId: companyId,
        invoiceNumber: `CR-${Date.now()}`, // CR = Credit Purchase
        plan: null, // Credit purchases aren't tied to a specific plan
        amount: dollarAmount,
        status: 'PAID',
        paidAt: new Date(),
        billingPeriodStart: null,
        billingPeriodEnd: null,
        stripeInvoiceId: null,
        stripePaymentIntentId: null,
      },
    });

    console.log(`✅ Credits purchased for company ${companyId}: ${result.creditsAdded} credits ($${dollarAmount})`);

    // TODO: Send confirmation email
  } catch (error) {
    console.error('Error handling credit purchase:', error);
  }
}

/**
 * Handle subscription checkout completion
 */
async function handleSubscriptionCheckout(companyId, planName, billingCycle, session) {
  try {
    console.log(`🔧 Upgrading plan - Company: ${companyId}, Plan: ${planName}, Cycle: ${billingCycle}`);
    console.log(`🔧 Customer ID: ${session.customer}, Subscription ID: ${session.subscription}`);

    // Upgrade the plan
    const result = await upgradePlan(companyId, planName, {
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      billingCycle: (billingCycle || 'MONTHLY').toUpperCase(),
    });

    console.log(`✅ Plan upgraded successfully to ${planName} for company ${companyId}`);
    console.log(`✅ Credits added: ${result.creditsAdded || 0}`);

    // TODO: Send confirmation email
  } catch (error) {
    console.error('❌ Error handling subscription checkout:', error);
    console.error('Error details:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

/**
 * Handle subscription created
 */
async function handleSubscriptionCreated(subscription) {
  const customerId = subscription.customer;

  try {
    const company = await prisma.company.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!company) {
      console.warn(`No company found for Stripe customer ${customerId}`);
      return;
    }

    // Update subscription info
    const nextBillingDate = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : null;

    await prisma.company.update({
      where: { id: company.id },
      data: {
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: 'ACTIVE',
        ...(nextBillingDate && { nextBillingDate }),
      },
    });

    console.log(`✅ Subscription created for company ${company.id}`);
  } catch (error) {
    console.error('Error handling subscription created:', error);
  }
}

/**
 * Handle subscription updated
 */
async function handleSubscriptionUpdated(subscription) {
  const customerId = subscription.customer;

  try {
    const company = await prisma.company.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!company) {
      console.warn(`No company found for Stripe customer ${customerId}`);
      return;
    }

    // Map Stripe status to our status
    const statusMap = {
      active: 'ACTIVE',
      past_due: 'PAST_DUE',
      canceled: 'CANCELED',
      unpaid: 'PAST_DUE',
      incomplete: 'INCOMPLETE',
      trialing: 'TRIALING',
    };

    const nextBillingDate = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : null;

    await prisma.company.update({
      where: { id: company.id },
      data: {
        subscriptionStatus: statusMap[subscription.status] || 'ACTIVE',
        ...(nextBillingDate && { nextBillingDate }),
      },
    });

    console.log(`✅ Subscription updated for company ${company.id}`);
  } catch (error) {
    console.error('Error handling subscription updated:', error);
  }
}

/**
 * Handle subscription deleted (cancelled)
 */
async function handleSubscriptionDeleted(subscription) {
  const customerId = subscription.customer;

  try {
    const company = await prisma.company.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!company) {
      console.warn(`No company found for Stripe customer ${customerId}`);
      return;
    }

    // Downgrade to Free plan
    await prisma.company.update({
      where: { id: company.id },
      data: {
        plan: 'Free',
        aiCredits: 0, // Free plan users who cancel get 0 credits
        subscriptionStatus: 'CANCELED',
        smsEnabled: false,
        emailEnabled: true,
      },
    });

    console.log(`✅ Subscription cancelled for company ${company.id}, downgraded to Free`);

    // TODO: Send cancellation email
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
  }
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(invoice) {
  const customerId = invoice.customer;
  const subscriptionId = invoice.subscription;

  try {
    const company = await prisma.company.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!company) {
      console.warn(`No company found for Stripe customer ${customerId}`);
      return;
    }

    // Check if this is a subscription renewal (monthly refill)
    if (subscriptionId && company.plan !== 'Free') {
      // Refill credits for monthly billing
      await refillCredits(company.id);

      console.log(`✅ Credits refilled for company ${company.id} after successful payment`);
    }

    // Create billing history record
    await prisma.billingHistory.create({
      data: {
        companyId: company.id,
        invoiceNumber: invoice.number || `INV-${Date.now()}`,
        plan: company.plan,
        amount: invoice.amount_paid / 100, // Convert from cents
        status: 'PAID',
        paidAt: new Date(),
        billingPeriodStart: new Date(invoice.period_start * 1000),
        billingPeriodEnd: new Date(invoice.period_end * 1000),
        stripeInvoiceId: invoice.id,
        stripePaymentIntentId: invoice.payment_intent,
      },
    });

    console.log(`✅ Payment succeeded for company ${company.id}: $${invoice.amount_paid / 100}`);

    // TODO: Send receipt email
  } catch (error) {
    console.error('Error handling payment succeeded:', error);
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice) {
  const customerId = invoice.customer;

  try {
    const company = await prisma.company.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!company) {
      console.warn(`No company found for Stripe customer ${customerId}`);
      return;
    }

    // Update subscription status
    await prisma.company.update({
      where: { id: company.id },
      data: {
        subscriptionStatus: 'PAST_DUE',
      },
    });

    console.log(`⚠️ Payment failed for company ${company.id}`);

    // TODO: Send payment failed email
    // TODO: Implement 2-day grace period logic
    // After 2 days of failed payments, downgrade to Free plan
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}

export default {
  handleStripeWebhook,
};
