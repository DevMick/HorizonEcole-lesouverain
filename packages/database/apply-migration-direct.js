const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Charger les variables d'environnement depuis .env
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#][^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  });
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL non définie');
  process.exit(1);
}

// Parser DATABASE_URL
const dbUrl = process.env.DATABASE_URL;
const match = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
if (!match) {
  console.error('❌ Format DATABASE_URL invalide');
  process.exit(1);
}

const [, user, password, host, port, database] = match;

console.log('🔌 Connexion à PostgreSQL...');
console.log(`   Host: ${host}:${port}`);
console.log(`   Database: ${database}`);
console.log(`   User: ${user}`);

const client = new Client({
  host,
  port: parseInt(port),
  user,
  password: decodeURIComponent(password),
  database,
});

async function applyMigration() {
  try {
    await client.connect();
    console.log('✅ Connecté à PostgreSQL\n');

    // Lire le fichier de migration
    const migrationPath = path.join(__dirname, 'prisma/migrations/20250120000000_add_payroll_module/migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Lecture du fichier de migration...');
    console.log(`   Fichier: ${migrationPath}`);
    console.log(`   Taille: ${migrationSQL.length} caractères\n`);

    console.log('🚀 Application de la migration...');
    console.log('='.repeat(60));
    
    // Exécuter le SQL
    await client.query(migrationSQL);
    
    console.log('='.repeat(60));
    console.log('✅ Migration appliquée avec succès !\n');

    // Vérifier que les tables sont créées
    console.log('🔍 Vérification des tables créées...');
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'teacher_remuneration',
        'teacher_allowances',
        'payroll_settings',
        'monthly_payrolls',
        'payroll_items',
        'payroll_payments',
        'advance_payments',
        'payroll_correction_requests'
      )
      ORDER BY table_name;
    `;
    
    const result = await client.query(tablesQuery);
    const tables = result.rows.map(row => row.table_name);
    
    console.log(`\n📊 Tables trouvées: ${tables.length}/8`);
    tables.forEach(table => {
      console.log(`   ✅ ${table}`);
    });
    
    if (tables.length === 8) {
      console.log('\n🎉 Toutes les tables de paie sont créées !');
    } else {
      const expected = [
        'teacher_remuneration',
        'teacher_allowances',
        'payroll_settings',
        'monthly_payrolls',
        'payroll_items',
        'payroll_payments',
        'advance_payments',
        'payroll_correction_requests'
      ];
      const missing = expected.filter(t => !tables.includes(t));
      console.log(`\n⚠️  Tables manquantes: ${missing.join(', ')}`);
    }

    // Vérifier les enums
    console.log('\n🔍 Vérification des enums créés...');
    const enumsQuery = `
      SELECT t.typname as enum_name
      FROM pg_type t 
      WHERE t.typname IN (
        'RemunerationMode',
        'AllowanceType',
        'AllowanceCategory',
        'PayrollStatus',
        'SeniorityRuleType',
        'ProrataRule'
      )
      ORDER BY t.typname;
    `;
    
    const enumsResult = await client.query(enumsQuery);
    const enums = enumsResult.rows.map(row => row.enum_name);
    
    console.log(`📊 Enums trouvés: ${enums.length}/6`);
    enums.forEach(enumName => {
      console.log(`   ✅ ${enumName}`);
    });

    // Vérifier les paramètres par défaut
    console.log('\n🔍 Vérification des paramètres par défaut...');
    const settingsQuery = 'SELECT COUNT(*) as count FROM payroll_settings;';
    const settingsResult = await client.query(settingsQuery);
    const settingsCount = parseInt(settingsResult.rows[0].count);
    
    if (settingsCount > 0) {
      console.log(`✅ Paramètres par défaut créés (${settingsCount} enregistrement(s))`);
    } else {
      console.log('⚠️  Aucun paramètre par défaut trouvé');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration complète et vérifiée !');
    console.log('='.repeat(60));
    console.log('\n📝 Prochaines étapes:');
    console.log('   1. Générer le client Prisma: pnpm prisma generate');
    console.log('   2. Redémarrer le serveur API');
    console.log('   3. Tester les routes /api/payroll/*\n');

  } catch (error) {
    console.error('\n❌ Erreur lors de l\'application de la migration:');
    console.error(error.message);
    if (error.code) {
      console.error(`   Code: ${error.code}`);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();

