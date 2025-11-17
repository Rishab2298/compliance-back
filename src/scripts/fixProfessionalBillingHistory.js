import prisma from '../../prisma/client.js';

/**
 * Script to fix the Professional plan billing history
 * Updates the $149 transaction to show "Professional" plan
 */
async function fixProfessionalBillingHistory() {
  try {
    const companyId = '3234273d-3f62-4d77-a5e7-dd5be60a6b79';
    const amount = 149;

    console.log(`🔧 Finding billing history for $${amount} Professional plan purchase...`);

    // Find the billing history record
    const billingRecord = await prisma.billingHistory.findFirst({
      where: {
        companyId: companyId,
        amount: amount,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!billingRecord) {
      console.error('❌ Billing history record not found for $149 purchase!');
      return;
    }

    console.log(`📊 Current billing record:`);
    console.log(`   Invoice Number: ${billingRecord.invoiceNumber}`);
    console.log(`   Plan: ${billingRecord.plan || 'null'}`);
    console.log(`   Amount: $${billingRecord.amount}`);
    console.log(`   Status: ${billingRecord.status}`);

    // Update the billing record to show Professional plan
    const updatedRecord = await prisma.billingHistory.update({
      where: { id: billingRecord.id },
      data: {
        plan: 'Professional',
      },
    });

    console.log(`\n✅ Successfully updated billing history!`);
    console.log(`   Invoice Number: ${updatedRecord.invoiceNumber}`);
    console.log(`   Plan: ${updatedRecord.plan}`);
    console.log(`   Amount: $${updatedRecord.amount}`);
    console.log(`\n🎉 Your billing history now correctly shows Professional plan!`);

  } catch (error) {
    console.error('❌ Error fixing billing history:', error);
    console.error('Error details:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixProfessionalBillingHistory();
