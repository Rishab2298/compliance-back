import prisma from '../../prisma/client.js';

/**
 * Script to check company details
 */
async function checkCompanyDetails() {
  try {
    const companyId = 'f59242e5-0484-461e-a703-d3f2c7cf2fe9';

    console.log(`🔍 Checking company details for ${companyId}...`);

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { adminUser: true },
    });

    if (!company) {
      console.error('❌ Company not found!');
      return;
    }

    console.log(`\n📊 Company Details:`);
    console.log(`   ID: ${company.id}`);
    console.log(`   Name: ${company.name || 'NOT SET'}`);
    console.log(`   Admin Email: ${company.adminEmail || 'NOT SET'}`);
    console.log(`   Admin Phone: ${company.adminPhone || 'NOT SET'}`);
    console.log(`   Plan: ${company.plan}`);
    console.log(`   Credits: ${company.aiCredits}`);

    console.log(`\n👤 Admin User Details:`);
    console.log(`   Name: ${company.adminUser?.name || 'NOT SET'}`);
    console.log(`   Email: ${company.adminUser?.email || 'NOT SET'}`);
    console.log(`   Phone: ${company.adminUser?.phone || 'NOT SET'}`);

  } catch (error) {
    console.error('❌ Error checking company details:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCompanyDetails();
