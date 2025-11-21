import prisma from '../../prisma/client.js';
import { DEFAULT_DOCUMENT_TYPES } from '../utils/documentTypeDefaults.js';

/**
 * Force update all companies to the latest document type configurations
 * This will OVERWRITE existing configurations with the new defaults
 */
async function forceUpdateDocumentTypes() {
  console.log('🔄 Force updating document type configurations...\n');

  try {
    // Fetch all companies
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        name: true,
      },
    });

    console.log(`📊 Found ${companies.length} companies to update\n`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const company of companies) {
      try {
        // Force update with latest defaults
        await prisma.company.update({
          where: { id: company.id },
          data: {
            documentTypeConfigs: DEFAULT_DOCUMENT_TYPES,
          },
        });

        console.log(`✅ Updated ${company.name} - Now has ${Object.keys(DEFAULT_DOCUMENT_TYPES).length} document types`);
        updatedCount++;
      } catch (error) {
        console.error(`❌ Error updating ${company.name}:`, error.message);
        errorCount++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 UPDATE SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Companies:      ${companies.length}`);
    console.log(`✅ Successfully Updated: ${updatedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('='.repeat(60));

    console.log('\n📋 New Document Types:');
    Object.keys(DEFAULT_DOCUMENT_TYPES).forEach((typeName, index) => {
      const config = DEFAULT_DOCUMENT_TYPES[typeName];
      const fieldCount = config.fields?.length || 0;
      console.log(`  ${index + 1}. ${typeName} - ${fieldCount} fields (${config.extractionMode})`);
    });

    console.log('\n✨ Update completed successfully!');

  } catch (error) {
    console.error('\n❌ FATAL ERROR during update:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the update
forceUpdateDocumentTypes();
