import prisma from '../../prisma/client.js';

/**
 * Script to add missing billing history for credit purchases
 * Run this if you made credit purchases before billing history tracking was added
 */
async function addMissingBillingHistory() {
  try {
    const companyId = '3234273d-3f62-4d77-a5e7-dd5be60a6b79';
    const dollarAmount = 50;
    const creditsAmount = 400;
    const purchaseDate = new Date(); // You can adjust this to the actual purchase date

    console.log(`Adding missing billing history for $${dollarAmount} credit purchase...`);

    const billingRecord = await prisma.billingHistory.create({
      data: {
        companyId: companyId,
        invoiceNumber: `CR-${Date.now()}`,
        plan: null, // Credit purchases aren't tied to a specific plan
        amount: dollarAmount,
        status: 'PAID',
        paidAt: purchaseDate,
        billingPeriodStart: null,
        billingPeriodEnd: null,
        stripeInvoiceId: null,
        stripePaymentIntentId: null,
      },
    });

    console.log(`✅ Successfully added billing history record:`);
    console.log(`   Invoice Number: ${billingRecord.invoiceNumber}`);
    console.log(`   Amount: $${billingRecord.amount}`);
    console.log(`   Company ID: ${billingRecord.companyId}`);
    console.log(`   Credits: ${creditsAmount}`);

    console.log('\n🎉 Done! The transaction should now appear in your billing history.');

  } catch (error) {
    console.error('❌ Error adding billing history:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addMissingBillingHistory();
