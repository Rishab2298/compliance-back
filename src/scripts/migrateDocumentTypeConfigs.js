import prisma from '../../prisma/client.js';
import { DEFAULT_DOCUMENT_TYPES } from '../utils/documentTypeDefaults.js';

/**
 * Data Migration Script: Populate documentTypeConfigs for all companies
 *
 * This script populates the new documentTypeConfigs field for all existing companies
 * with the 8 default document type configurations.
 *
 * Run this AFTER applying the Prisma migration that adds the documentTypeConfigs field.
 *
 * Usage:
 *   node src/scripts/migrateDocumentTypeConfigs.js
 *
 * What it does:
 * 1. Fetches all companies from the database
 * 2. For each company that doesn't have documentTypeConfigs set (or has empty config):
 *    - Populates it with the 8 default document types
 * 3. Skips companies that already have custom configurations
 */

async function migrateDocumentTypeConfigs() {
  console.log('🚀 Starting document type configuration migration...\n');

  try {
    // Fetch all companies
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        name: true,
        documentTypeConfigs: true,
        documentTypes: true, // Old field for reference
      },
    });

    console.log(`📊 Found ${companies.length} companies to process\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const company of companies) {
      try {
        // Check if company already has configurations
        const existingConfigs = company.documentTypeConfigs;

        // Skip if already has custom configurations (non-empty object)
        if (
          existingConfigs &&
          typeof existingConfigs === 'object' &&
          Object.keys(existingConfigs).length > 0
        ) {
          console.log(`⏭️  Skipping ${company.name} - Already has configurations`);
          skippedCount++;
          continue;
        }

        // Populate with default configurations
        await prisma.company.update({
          where: { id: company.id },
          data: {
            documentTypeConfigs: DEFAULT_DOCUMENT_TYPES,
          },
        });

        console.log(`✅ Migrated ${company.name} - Added ${Object.keys(DEFAULT_DOCUMENT_TYPES).length} default types`);
        migratedCount++;
      } catch (error) {
        console.error(`❌ Error migrating ${company.name}:`, error.message);
        errorCount++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Companies:      ${companies.length}`);
    console.log(`✅ Successfully Migrated: ${migratedCount}`);
    console.log(`⏭️  Skipped (already configured): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('='.repeat(60));

    if (migratedCount > 0) {
      console.log('\n✨ Migration completed successfully!');
      console.log('\nNext steps:');
      console.log('1. Verify in Prisma Studio that companies have documentTypeConfigs populated');
      console.log('2. Test the document type configuration API endpoints');
      console.log('3. Continue with Phase 2 implementation');
    } else {
      console.log('\n⚠️  No companies needed migration');
    }

  } catch (error) {
    console.error('\n❌ FATAL ERROR during migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateDocumentTypeConfigs();
