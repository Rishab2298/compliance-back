import prisma from '../../prisma/client.js';
import crypto from 'crypto';

/**
 * Fix script to set policiesAccepted = true for admin users who completed onboarding
 * AND create proper consent logs for them
 * This is needed for users who completed onboarding before the policy acceptance fix
 */
async function fixPolicyAcceptance() {
  try {
    console.log('🔧 Fixing policy acceptance for admin users...\n');

    // Find all users who are company admins (have companyAdmin relation)
    const adminUsers = await prisma.user.findMany({
      where: {
        companyAdmin: {
          isNot: null,
        },
        policiesAccepted: false, // Only update those who haven't been marked
      },
      include: {
        companyAdmin: true,
      },
    });

    console.log(`Found ${adminUsers.length} admin user(s) who need policy acceptance update\n`);

    if (adminUsers.length === 0) {
      console.log('✅ No users need updating. All admins already have policy acceptance set!');
      return;
    }

    // Get all latest published policies
    const policyTypes = [
      'TERMS_OF_SERVICE',
      'PRIVACY_POLICY',
      'DATA_PROCESSING_AGREEMENT',
      'SMS_CONSENT',
      'COOKIE_PREFERENCES',
      'SUPPORT_ACCESS',
    ];

    const policies = await prisma.policy.findMany({
      where: {
        type: { in: policyTypes },
        isPublished: true,
      },
      orderBy: {
        publishedAt: 'desc',
      },
      distinct: ['type'],
    });

    console.log(`Found ${policies.length} published policies\n`);

    // Update each admin user
    for (const user of adminUsers) {
      console.log(`Processing user: ${user.email || user.clerkUserId}`);
      console.log(`  Company: ${user.companyAdmin.name}`);

      // Create policy acceptance records for this admin
      console.log(`  Creating ${policies.length} consent log(s)...`);

      for (const policy of policies) {
        const contentHash = crypto.createHash('sha256').update(policy.content).digest('hex');

        await prisma.userPolicyAcceptance.upsert({
          where: {
            userId_policyId: {
              userId: user.id,
              policyId: policy.id,
            },
          },
          create: {
            userId: user.id,
            policyId: policy.id,
            policyType: policy.type,
            policyVersion: policy.version,
            contentHash,
            ipAddress: 'system-backfill',
            region: 'Unknown',
            userAgent: 'System Backfill Script',
            userEmail: user.email,
            companyId: user.companyAdmin.id,
            isMandatory: true,
          },
          update: {
            acceptedAt: new Date(),
            contentHash,
          },
        });
      }

      // Update user's policiesAccepted flag
      await prisma.user.update({
        where: { id: user.id },
        data: {
          policiesAccepted: true,
          policiesAcceptedAt: new Date(),
        },
      });

      console.log(`  ✅ Updated with ${policies.length} consent logs\n`);
    }

    console.log(`\n✅ Successfully updated ${adminUsers.length} admin user(s)!`);
    console.log('Each admin now has proper consent logs in the database.');
    console.log('You can now upgrade to paid plans without policy acceptance errors.\n');
  } catch (error) {
    console.error('❌ Error fixing policy acceptance:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixPolicyAcceptance()
  .then(() => {
    console.log('Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
