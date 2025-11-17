import prisma from '../../prisma/client.js';
import { constructWebhookEvent } from '../services/stripeService.js';
import { upgradePlan, purchaseCredits, refillCredits } from '../services/billingService.js';

/**
 * Handle Stripe Webhook Events
 * POST /api/stripe-webhook
 */
export const handleStripeWebhook = async (req, res) => {
  const signature = req.headers['stripe-signature'];

  console.log('\n🔔 ===== STRIPE WEBHOOK RECEIVED =====');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Signature present: ${!!signature}`);

  try {
    // Construct and verify the event
    const event = constructWebhookEvent(req.body, signature);

    console.log(`✅ Webhook signature verified`);
    console.log(`📦 Event Type: ${event.type}`);
    console.log(`🆔 Event ID: ${event.id}`);

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        console.log(`\n🛒 Processing checkout.session.completed...`);
        await handleCheckoutCompleted(event.data.object);
        break;

      case 'customer.subscription.created':
        console.log(`\n📝 Processing customer.subscription.created...`);
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        console.log(`\n🔄 Processing customer.subscription.updated...`);
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        console.log(`\n🗑️  Processing customer.subscription.deleted...`);
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        console.log(`\n💰 Processing invoice.payment_succeeded...`);
        await handlePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        console.log(`\n❌ Processing invoice.payment_failed...`);
        await handlePaymentFailed(event.data.object);
        break;

      default:
        console.log(`⚠️  Unhandled event type: ${event.type}`);
    }

    console.log(`\n✅ Webhook processed successfully`);
    console.log(`===== STRIPE WEBHOOK COMPLETED =====\n`);

    // Return a 200 response to acknowledge receipt of the event
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('\n❌ ===== WEBHOOK ERROR =====');
    console.error(`Error Type: ${error.name}`);
    console.error(`Error Message: ${error.message}`);
    console.error(`Stack:`, error.stack);
    console.error(`===== WEBHOOK FAILED =====\n`);
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
    console.log('\n=== 🔧 SUBSCRIPTION CHECKOUT STARTED ===');
    console.log(`Company ID: ${companyId}`);
    console.log(`Plan: ${planName}`);
    console.log(`Billing Cycle: ${billingCycle}`);
    console.log(`Stripe Customer ID: ${session.customer}`);
    console.log(`Stripe Subscription ID: ${session.subscription}`);
    console.log(`Session ID: ${session.id}`);

    // Verify company exists before upgrade
    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      console.error(`❌ Company not found: ${companyId}`);
      throw new Error(`Company not found: ${companyId}`);
    }

    console.log(`📊 Current company state:`);
    console.log(`  - Current Plan: ${company.plan}`);
    console.log(`  - Current Credits: ${company.aiCredits}`);
    console.log(`  - Subscription Status: ${company.subscriptionStatus}`);
    console.log(`  - Pending Plan Change: ${company.pendingPlanChange}`);

    // Upgrade the plan
    console.log(`\n🚀 Calling upgradePlan function...`);
    const result = await upgradePlan(companyId, planName, {
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      billingCycle: (billingCycle || 'MONTHLY').toUpperCase(),
    });

    console.log(`\n✅ PLAN UPGRADE SUCCESSFUL`);
    console.log(`  - Old Plan: ${result.oldPlan}`);
    console.log(`  - New Plan: ${result.newPlan}`);
    console.log(`  - Credits Added: ${result.creditsAdded}`);
    console.log(`  - New Balance: ${result.newBalance}`);

    // Create billing history record for the subscription purchase
    // We do this here (not in invoice.payment_succeeded) to ensure we have the correct plan
    const planLimits = await import('../config/planLimits.js').then(m => m.getPlanLimits(planName));
    const amount = billingCycle === 'yearly' ? planLimits.yearlyPrice : planLimits.price;

    await prisma.billingHistory.create({
      data: {
        companyId: companyId,
        invoiceNumber: `SUB-${Date.now()}`, // SUB = Subscription
        plan: planName, // Use the NEW plan name, not company.plan
        amount: amount,
        status: 'PAID',
        paidAt: new Date(),
        billingPeriodStart: new Date(),
        billingPeriodEnd: new Date(Date.now() + (billingCycle === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000),
        stripeInvoiceId: null,
        stripePaymentIntentId: null,
      },
    });

    console.log(`✅ Billing history created for ${planName} subscription`);
    console.log(`=== ✅ SUBSCRIPTION CHECKOUT COMPLETED ===\n`);

    // TODO: Send confirmation email
  } catch (error) {
    console.error('\n❌ ERROR HANDLING SUBSCRIPTION CHECKOUT');
    console.error(`Company ID: ${companyId}`);
    console.error(`Plan: ${planName}`);
    console.error(`Error Name: ${error.name}`);
    console.error(`Error Message: ${error.message}`);
    console.error(`Stack Trace:`, error.stack);
    console.error(`=== ❌ SUBSCRIPTION CHECKOUT FAILED ===\n`);
    throw error;
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

    // Only create billing history for subscription renewals, not initial subscription
    // Initial subscription billing history is created in handleSubscriptionCheckout
    const isInitialSubscription = invoice.billing_reason === 'subscription_create';

    if (isInitialSubscription) {
      console.log(`ℹ️  Skipping billing history for initial subscription invoice (already created in checkout)`);
    } else {
      // Create billing history record for renewals and other payments
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

      console.log(`✅ Billing history created for company ${company.id}: $${invoice.amount_paid / 100}`);
    }

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
