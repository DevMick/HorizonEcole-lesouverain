const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Charger les variables d'environnement
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

console.log('🔍 Vérification du statut de la migration...\n');

try {
  // Vérifier le statut de la migration
  console.log('1️⃣  Vérification du statut des migrations Prisma...');
  const status = execSync('npx prisma migrate status', {
    cwd: __dirname,
    env: process.env,
    encoding: 'utf8'
  });
  console.log(status);
  
  // Vérifier si les tables existent dans la base de données
  console.log('\n2️⃣  Vérification des tables dans la base de données...');
  const tablesToCheck = [
    'teacher_remuneration',
    'teacher_allowances',
    'payroll_settings',
    'monthly_payrolls',
    'payroll_items',
    'payroll_payments',
    'advance_payments',
    'payroll_correction_requests'
  ];
  
  // Utiliser Prisma pour vérifier les tables
  const checkQuery = `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN (${tablesToCheck.map(t => `'${t}'`).join(', ')})
    ORDER BY table_name;
  `;
  
  try {
    const result = execSync(`npx prisma db execute --stdin`, {
      input: checkQuery,
      cwd: __dirname,
      env: process.env,
      encoding: 'utf8'
    });
    console.log('Tables trouvées:');
    console.log(result);
    
    // Compter les tables trouvées
    const foundTables = tablesToCheck.filter(table => 
      result.includes(table)
    );
    
    console.log(`\n✅ ${foundTables.length}/${tablesToCheck.length} tables de paie trouvées`);
    
    if (foundTables.length === tablesToCheck.length) {
      console.log('🎉 Toutes les tables de paie sont créées !');
    } else {
      const missing = tablesToCheck.filter(t => !foundTables.includes(t));
      console.log(`⚠️  Tables manquantes: ${missing.join(', ')}`);
      console.log('\n💡 Pour appliquer la migration, exécutez:');
      console.log('   pnpm prisma migrate deploy');
    }
  } catch (error) {
    console.log('⚠️  Impossible de vérifier directement les tables');
    console.log('   Vérifiez manuellement avec: pnpm prisma migrate status');
  }
  
} catch (error) {
  console.error('❌ Erreur:', error.message);
  console.log('\n💡 Pour appliquer la migration, exécutez:');
  console.log('   cd packages/database');
  console.log('   pnpm prisma migrate deploy');
  console.log('   pnpm prisma generate');
}

