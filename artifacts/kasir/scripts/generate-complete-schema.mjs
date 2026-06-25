import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '..', 'migrations');
const outputPath = path.join(migrationsDir, 'complete-schema.sql');

// This is the correct chronological sequence of migrations starting from the base schema.
// Migrations prior to supabase-schema.sql are already baseline-integrated.
const migrationFiles = [
  'supabase-schema.sql',
  'supabase-rls-policies.sql',
  'migration-setup-product-images-storage.sql',
  'migration-fix-table-ownership.sql',
  'migration-multi-tenant-kasir.sql',
  'migration-fix-sales-access.sql',
  'migration-setup-kasir-auth.sql',
  'migration-setup-admin-auth.sql',
  'migration-grant-authenticated-role.sql',
  'migration-add-outlets-table.sql',
  'migration-fix-missing-columns.sql',
  'migration-create-expenses-table.sql',
  'migration-add-expenses-owner-id.sql',
  'migration-expenses-rls.sql',
  'migration-add-expenses-outlet-id.sql',
  'migration-add-products-outlet-id.sql',
  'migration-setup-staff.sql',
  'migration-points-settings.sql',
  'migration-discount-settings.sql',
  'migration-add-allowed-promos.sql',
  'migration-products-allowed-outlets.sql',
  'migration-add-staff-avatar.sql',
  'migration-fix-storage-policies.sql',
  'migration-drop-select-policy.sql',
  'migration-strict-storage-policies.sql',
  'migration-final-storage-policies.sql',
  'migration-expense-categories.sql',
  'migration-numeric-precision.sql',
  'migration-category-outlets.sql',
  'setup-promo-system.sql',
  'fix-promo-permissions.sql',
  'migration-add-promo-templates.sql',
  'ultimate-promo-fix.sql',
  'nuclear-fix-promo.sql',
  'migration-promo-logs.sql',
  'migration-promo-rls.sql',
  'migration-add-staff-owner-id.sql',
  'final_promo_fix.sql',
  'migration-add-expenses-supplier.sql',
  'migration-add-expenses-image.sql',
  'migration-setup-expense-receipts-storage.sql',
  'migration-add-outlets-footers.sql',
  'migration-enable-realtime-sync.sql'
];

async function generate() {
  console.log('Generating complete-schema.sql...');
  let combinedSql = `-- =============================================================================\n`;
  combinedSql += `-- CONSOLIDATED SUPABASE DATABASE SCHEMA & MIGRATIONS\n`;
  combinedSql += `-- Generated on: ${new Date().toISOString()}\n`;
  combinedSql += `-- Suitable for fresh setup of new clients/databases.\n`;
  combinedSql += `-- =============================================================================\n\n`;

  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`Warning: Migration file not found: ${file}`);
      continue;
    }

    console.log(`- Adding: ${file}`);
    const content = fs.readFileSync(filePath, 'utf8');
    combinedSql += `-- -----------------------------------------------------------------------------\n`;
    combinedSql += `-- FILE: ${file}\n`;
    combinedSql += `-- -----------------------------------------------------------------------------\n\n`;
    combinedSql += content;
    combinedSql += `\n\n`;
  }

  fs.writeFileSync(outputPath, combinedSql, 'utf8');
  console.log(`Success! Consolidated schema written to: ${outputPath}`);
}

generate().catch(err => {
  console.error('Failed to generate consolidated schema:', err);
  process.exit(1);
});
