import { PrismaClient } from '@prisma/client';
import { getPlanLimits } from '../config/planLimits.js';

const prisma = new PrismaClient();

/**
 * Test what the billing API returns for company data
 */
async function testBillingAPI() {
  try {
    const companyId = 'f59242e5-0484-461e-a703-d3f2c7cf2fe9';

    console.log(`🔍 Testing billing API data for ${companyId}...`);

    // Simulate what the API does
    const user = await prisma.user.findFirst({
      where: { companyId: companyId },
      include: { companyAdmin: true },
    });

    if (!user || !user.companyAdmin) {
      console.error('❌ User or company not found');
      return;
    }

    const company = user.companyAdmin;

    console.log(`\n📊 What API Should Return:`);
    console.log(`   Company ID: ${company.id}`);
    console.log(`   Company Name: ${company.name}`);
    console.log(`   Admin Email: ${company.adminEmail}`);
    console.log(`   Admin Phone: ${company.adminPhone}`);

    const companyData = {
      id: company.id,
      name: company.name,
      email: company.adminEmail,
      phone: company.adminPhone,
    };

    console.log(`\n📦 Company Object for Frontend:`);
    console.log(JSON.stringify(companyData, null, 2));

  } catch (error) {
    console.error('❌ Error testing billing API:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testBillingAPI();
