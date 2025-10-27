# Stripe Webhooks Testing Guide

## 📋 Overview

This guide explains how Stripe webhooks work and how to test them in development and production environments.

## 🔔 What are Webhooks?

Webhooks are HTTP callbacks that Stripe sends to your server when events occur in your Stripe account. They're essential for:
- Tracking successful payments
- Creating billing history records
- Handling subscription changes
- Managing failed payments

## ✅ Webhooks Currently Implemented

Our application handles these Stripe webhook events:

### 1. **checkout.session.completed**
- Triggered when a customer completes a checkout session
- Handles both:
  - **Credit purchases** (one-time payments)
  - **Plan upgrades** (subscription creation)
- **Creates billing history** for credit purchases

### 2. **invoice.payment_succeeded**
- Triggered when a subscription payment succeeds
- Refills monthly AI credits
- **Creates billing history** for subscription payments

### 3. **customer.subscription.created**
- Triggered when a new subscription is created
- Updates company plan information

### 4. **customer.subscription.updated**
- Triggered when subscription details change
- Updates billing cycle or plan changes

### 5. **customer.subscription.deleted**
- Triggered when a subscription is cancelled
- Downgrades company to Free plan

### 6. **invoice.payment_failed**
- Triggered when a payment fails
- Marks subscription as PAST_DUE

## 🧪 Testing Webhooks in Development

### Yes, You Can Test Webhooks Locally! ✅

Stripe provides the **Stripe CLI** to forward webhooks to your local development server.

### Step 1: Install Stripe CLI

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Windows
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe

# Linux
wget https://github.com/stripe/stripe-cli/releases/download/v1.17.2/stripe_1.17.2_linux_x86_64.tar.gz
tar -xvf stripe_1.17.2_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin
```

### Step 2: Login to Stripe CLI

```bash
stripe login
```

This opens your browser to authenticate.

### Step 3: Forward Webhooks to Local Server

```bash
# Forward all webhooks to your local server
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

You'll see output like:
```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx (^C to quit)
```

### Step 4: Add Webhook Secret to .env

Copy the signing secret from the CLI output and add to your `.env`:

```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### Step 5: Restart Your Backend

```bash
cd backend
npm run dev
```

### Step 6: Test Webhooks

Now when you make a test payment in your frontend:
1. The Stripe CLI will receive the webhook
2. Forward it to your local server at `localhost:3000/api/stripe/webhook`
3. You'll see logs in both the CLI and your backend terminal

## 🧪 Trigger Test Webhooks Manually

You can trigger test webhooks without making actual payments:

```bash
# Test credit purchase
stripe trigger checkout.session.completed

# Test subscription payment
stripe trigger invoice.payment_succeeded

# Test subscription cancellation
stripe trigger customer.subscription.deleted
```

## 🚀 Production Webhooks

### Setup Production Webhooks

1. Go to [Stripe Dashboard > Developers > Webhooks](https://dashboard.stripe.com/webhooks)

2. Click **"Add endpoint"**

3. Enter your production URL:
   ```
   https://your-domain.com/api/stripe/webhook
   ```

4. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

5. Copy the **Signing Secret** (starts with `whsec_`)

6. Add to your production environment variables:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_production_secret_here
   ```

## 🔍 Verifying Webhooks Work

### Check Backend Logs

When webhooks are received, you'll see logs like:
```
🔔 Stripe webhook received: checkout.session.completed
✅ Credits purchased for company abc123: 40 credits ($5)
```

### Check Database

Credit purchases create records in `BillingHistory`:
```sql
SELECT * FROM BillingHistory
WHERE invoiceNumber LIKE 'CR-%'
ORDER BY createdAt DESC;
```

Subscription payments create records with plan info:
```sql
SELECT * FROM BillingHistory
WHERE plan IS NOT NULL
ORDER BY createdAt DESC;
```

### Check Stripe Dashboard

Go to [Stripe Dashboard > Developers > Webhooks](https://dashboard.stripe.com/webhooks)
- Click on your webhook endpoint
- View recent webhook deliveries
- See success/failure status
- Retry failed webhooks

## 🐛 Troubleshooting

### Webhook Not Received

**Problem:** Made a test payment but billing history not created

**Solutions:**
1. Check Stripe CLI is running:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

2. Verify webhook secret in `.env` matches CLI output

3. Check backend is running on correct port (3000)

4. Look for errors in backend console

### Webhook Signature Verification Failed

**Problem:** `Webhook Error: No signatures found matching the expected signature`

**Solutions:**
1. Make sure `STRIPE_WEBHOOK_SECRET` is set correctly
2. For local dev, use the secret from `stripe listen` output
3. For production, use the secret from Stripe Dashboard
4. Restart your backend after changing `.env`

### Credit Purchase Not Creating Billing History

**Problem:** Credits are added but no invoice shows up

**Solution:** This was fixed! The webhook now creates billing history records with:
- Invoice number: `CR-{timestamp}` (CR = Credit Purchase)
- Plan: `null` (credit purchases aren't tied to plans)
- Type shown as: "Credit Purchase" in the UI

## 📊 Webhook Event Types

### One-Time Payments (Credit Purchases)
```
checkout.session.completed
└── Creates billing history immediately
└── Invoice number: CR-1234567890
└── Type: Credit Purchase
```

### Subscriptions (Plan Upgrades)
```
checkout.session.completed
└── Creates subscription

customer.subscription.created
└── Updates company plan

invoice.payment_succeeded (recurring)
└── Creates billing history
└── Refills monthly credits
└── Invoice number: INV-1234567890
└── Type: {Plan Name} Plan
```

## 🎯 Key Points

1. ✅ **Test webhooks work locally** with Stripe CLI
2. ✅ **Credit purchases** create billing history via `checkout.session.completed`
3. ✅ **Subscription payments** create billing history via `invoice.payment_succeeded`
4. ✅ **All transactions** appear in the billing history page
5. ⚠️ **Must use Stripe CLI** in development to receive webhooks

## 📝 Summary

- **Development:** Use Stripe CLI to forward webhooks to localhost
- **Production:** Configure webhook endpoint in Stripe Dashboard
- **Credit Purchases:** Tracked via `checkout.session.completed` webhook
- **Subscriptions:** Tracked via `invoice.payment_succeeded` webhook
- **Billing History:** All transactions are recorded and displayed

## 🔗 Useful Links

- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Testing Webhooks](https://stripe.com/docs/webhooks/test)
- [Webhook Event Types](https://stripe.com/docs/api/events/types)
