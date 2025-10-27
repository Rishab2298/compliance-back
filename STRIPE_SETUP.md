# Stripe Integration Setup Guide

This guide walks you through setting up Stripe for the LogiLink billing system.

## Overview

The LogiLink billing system uses Stripe for:
- Subscription management (Starter, Professional plans)
- One-time credit purchases
- Payment method management
- Automated billing and invoicing

## Step 1: Create a Stripe Account

1. Go to [stripe.com](https://stripe.com) and create an account
2. Complete the account verification process
3. Navigate to the Dashboard

## Step 2: Get Your API Keys

### Test Mode Keys (for development)

1. In the Stripe Dashboard, click **Developers** → **API keys**
2. Copy your **Publishable key** (starts with `pk_test_`)
3. Copy your **Secret key** (starts with `sk_test_`)
4. Add them to your `.env` file:

```env
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
```

### Production Keys (for live environment)

1. Toggle to **Live mode** in the Stripe Dashboard
2. Copy the live keys (start with `pk_live_` and `sk_live_`)
3. Add them to your production environment variables

## Step 3: Set Up Webhook Endpoint

Webhooks allow Stripe to notify your backend about payment events.

### Create Webhook in Stripe Dashboard

1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Enter your webhook URL:
   - **Local development**: Use [ngrok](https://ngrok.com) or similar tool
     - Example: `https://your-ngrok-url.ngrok.io/api/stripe-webhook`
   - **Production**: `https://your-domain.com/api/stripe-webhook`

### Select Events to Listen To

Select the following events:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

### Get Webhook Secret

1. After creating the webhook, click on it
2. Copy the **Signing secret** (starts with `whsec_`)
3. Add it to your `.env` file:

```env
STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
```

## Step 4: Create Products and Prices (Optional)

**Note**: The current implementation creates prices dynamically. For production, it's recommended to create fixed products/prices in the Stripe Dashboard.

### Create Products

1. Go to **Products** → **Add product**
2. Create products for each plan:
   - **Starter Plan** - $49/month or $470/year
   - **Professional Plan** - $149/month or $1,430/year

### Get Price IDs

1. After creating products, copy the **Price ID** for each
2. Update `stripeService.js` to use these fixed price IDs instead of dynamic creation

## Step 5: Configure Billing Portal

The billing portal allows customers to manage their subscriptions and payment methods.

1. Go to **Settings** → **Billing** → **Customer portal**
2. Enable the portal
3. Configure allowed actions:
   - ✅ Update payment method
   - ✅ View invoices
   - ✅ Cancel subscription (optional)
4. Set up business information (shown in portal)

## Step 6: Test the Integration

### Testing Subscriptions

Use Stripe test cards:
- **Successful payment**: `4242 4242 4242 4242`
- **Payment requires authentication**: `4000 0025 0000 3155`
- **Payment declined**: `4000 0000 0000 9995`

Use any future expiry date, any 3-digit CVC, and any postal code.

### Test Workflow

1. Start your backend server
2. Call the upgrade endpoint:
   ```bash
   POST /api/billing/upgrade
   {
     "targetPlan": "Starter",
     "billingCycle": "monthly"
   }
   ```
3. You'll receive a `checkoutUrl` - visit it to complete payment
4. After successful payment, check your webhook endpoint receives events
5. Verify in database that company plan was upgraded

### Testing Webhooks Locally

Use Stripe CLI for local webhook testing:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:5003/api/stripe-webhook

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger invoice.payment_succeeded
```

## Step 7: Environment Variables Checklist

Ensure all these are set in your `.env` file:

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Frontend URL (for checkout redirects)
FRONTEND_URL=http://localhost:5173
```

## API Endpoints

### Available Billing Endpoints

```
GET    /api/billing/plans                  - Get all available plans
GET    /api/billing/current                - Get current plan and usage
POST   /api/billing/purchase-credits       - Purchase AI credits
POST   /api/billing/upgrade                - Upgrade to higher plan
POST   /api/billing/downgrade              - Schedule downgrade
POST   /api/billing/cancel-downgrade       - Cancel pending downgrade
GET    /api/billing/history                - Get billing history
GET    /api/billing/credit-transactions    - Get credit transactions
POST   /api/billing/check-limit            - Check if action is allowed
GET    /api/billing/portal                 - Get billing portal URL
POST   /api/stripe-webhook                 - Stripe webhook (no auth)
```

### Example: Upgrade to Starter Plan

```javascript
const response = await fetch('/api/billing/upgrade', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${clerkToken}`
  },
  body: JSON.stringify({
    targetPlan: 'Starter',
    billingCycle: 'monthly' // or 'yearly'
  })
});

const { data } = await response.json();
// Redirect user to Stripe checkout
window.location.href = data.checkoutUrl;
```

### Example: Purchase Credits

```javascript
const response = await fetch('/api/billing/purchase-credits', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${clerkToken}`
  },
  body: JSON.stringify({
    amount: 25 // $25 = 200 credits
  })
});

const { data } = await response.json();
window.location.href = data.checkoutUrl;
```

## Billing Flow

### Subscription Flow

1. User clicks "Upgrade" in frontend
2. Frontend calls `/api/billing/upgrade`
3. Backend creates Stripe checkout session
4. User is redirected to Stripe checkout
5. User completes payment
6. Stripe sends `checkout.session.completed` webhook
7. Backend upgrades plan and assigns credits
8. User is redirected back to app

### Credit Purchase Flow

1. User clicks "Buy Credits"
2. Frontend calls `/api/billing/purchase-credits`
3. Backend creates one-time payment session
4. User completes payment at Stripe
5. Stripe sends `checkout.session.completed` webhook
6. Backend adds credits to account
7. User is redirected back to app

### Monthly Billing Cycle

1. Stripe automatically charges on billing date
2. Stripe sends `invoice.payment_succeeded` webhook
3. Backend refills monthly credits (additive for paid plans)
4. Backend creates billing history record
5. User receives receipt email from Stripe

### Failed Payment Flow

1. Stripe attempts to charge card
2. Payment fails
3. Stripe sends `invoice.payment_failed` webhook
4. Backend marks subscription as `PAST_DUE`
5. Stripe retries payment (configured in Stripe Dashboard)
6. If still failing after 2 days:
   - Downgrade to Free plan (to be implemented via cron)
   - Send notification email to user

## Production Checklist

Before going live:

- [ ] Switch to Live API keys in production environment
- [ ] Create webhook endpoint with production URL
- [ ] Update `FRONTEND_URL` to production domain
- [ ] Create fixed products/prices in Stripe Dashboard
- [ ] Update code to use fixed price IDs
- [ ] Configure customer portal settings
- [ ] Set up business information in Stripe
- [ ] Test live mode with real cards
- [ ] Enable Stripe Radar for fraud prevention
- [ ] Set up automatic tax calculation (if applicable)
- [ ] Configure email receipts in Stripe
- [ ] Test webhook signature verification
- [ ] Enable billing alerts in Stripe

## Troubleshooting

### Webhook not receiving events

- Check webhook URL is correct and accessible
- Verify webhook secret matches `.env`
- Check server logs for errors
- Use Stripe CLI to test locally

### Payment succeeded but plan not upgraded

- Check webhook handler logs
- Verify metadata is being passed correctly in checkout session
- Check database for transaction records
- Look for errors in `stripeWebhookController.js`

### Checkout session not creating

- Verify Stripe keys are correct
- Check that plan exists in `planLimits.js`
- Ensure company and user exist in database
- Check Stripe Dashboard for API errors

## Support

For issues with:
- **Stripe integration**: Check Stripe docs at docs.stripe.com
- **Implementation**: Review code in `/src/services/stripeService.js`
- **Webhooks**: Review `/src/controllers/stripeWebhookController.js`
