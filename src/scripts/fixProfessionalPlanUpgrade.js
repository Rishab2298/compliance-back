import { PrismaClient } from '@prisma/client';
import { getPlanLimits } from '../config/planLimits.js';

const prisma = new PrismaClient();

/**
 * Script to manually fix the Professional plan upgrade
 * Run this if a plan purchase succeeded but the webhook didn't upgrade the plan
 */
async function fixProfessionalPlanUpgrade() {
  try {
    const companyId = '3234273d-3f62-4d77-a5e7-dd5be60a6b79';
    const targetPlan = 'Professional';

    console.log(`🔧 Fixing plan upgrade for company ${companyId}...`);

    // Get current company state
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      console.error('❌ Company not found!');
      return;
    }

    console.log(`📊 Current Plan: ${company.plan}`);
    console.log(`📊 Current Credits: ${company.aiCredits}`);

    // Get Professional plan limits
    const professionalPlan = getPlanLimits(targetPlan);
    console.log(`\n✨ Professional Plan Details:`);
    console.log(`   - Monthly AI Credits: ${professionalPlan.monthlyAICredits}`);
    console.log(`   - Max Drivers: ${professionalPlan.maxDrivers}`);
    console.log(`   - Max Docs per Driver: ${professionalPlan.maxDocumentsPerDriver}`);
    console.log(`   - SMS Enabled: ${professionalPlan.features.sms}`);

    // Calculate credits to add (monthly allotment for Professional)
    const creditsToAdd = professionalPlan.monthlyAICredits;

    // Update company to Professional plan
    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: {
        plan: targetPlan,
        aiCredits: {
          increment: creditsToAdd, // Add monthly credits
        },
        subscriptionStatus: 'ACTIVE',
        smsEnabled: professionalPlan.features.sms,
        emailEnabled: true,
        updatedAt: new Date(),
      },
    });

    console.log(`\n✅ Successfully upgraded to ${targetPlan} plan!`);
    console.log(`✅ Added ${creditsToAdd} AI credits`);
    console.log(`✅ New total credits: ${updatedCompany.aiCredits}`);
    console.log(`✅ SMS reminders enabled: ${updatedCompany.smsEnabled}`);
    console.log(`\n🎉 Your Professional plan is now active!`);

  } catch (error) {
    console.error('❌ Error fixing plan upgrade:', error);
    console.error('Error details:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixProfessionalPlanUpgrade();
