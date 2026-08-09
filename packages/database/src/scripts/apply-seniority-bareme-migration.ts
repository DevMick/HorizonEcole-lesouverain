import { config } from 'dotenv';
import { prisma } from '../index';
import { readFileSync } from 'fs';
import { join } from 'path';

// Charger les variables d'environnement depuis la racine du projet
config({ path: join(__dirname, '../../../.env') });

async function applyMigration() {
  try {
    console.log('🔌 Connexion à la base de données...');
    await prisma.$connect();
    console.log('✅ Connecté\n');

    const migrationPath = join(__dirname, '../../prisma/migrations/20250121000000_add_seniority_bareme/migration.sql');
    console.log('📄 Lecture du fichier de migration...');
    console.log(`   Fichier: ${migrationPath}\n`);
    
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    console.log('🚀 Application de la migration SQL...');
    console.log('='.repeat(60));
    
    // Diviser le SQL en commandes individuelles
    const commands = migrationSQL
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd && !cmd.startsWith('--'));
    
    console.log(`   ${commands.length} commande(s) SQL à exécuter\n`);
    
    // Exécuter chaque commande
    let successCount = 0;
    let skipCount = 0;
    
    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      if (!cmd) continue;
      
      try {
        await prisma.$executeRawUnsafe(cmd);
        successCount++;
        console.log(`   ✅ Commande ${i + 1}/${commands.length} exécutée`);
      } catch (error: any) {
        // Ignorer les erreurs "already exists" ou "column already exists"
        if (
          error.message?.includes('already exists') ||
          error.message?.includes('existe déjà') ||
          error.message?.includes('duplicate column') ||
          error.code === '42701' // duplicate_column
        ) {
          skipCount++;
          console.log(`   ℹ️  Commande ${i + 1}/${commands.length} ignorée (déjà existante)`);
        } else {
          console.error(`\n   ❌ Erreur à la commande ${i + 1}/${commands.length}:`);
          console.error(`   ${error.message}`);
          throw error;
        }
      }
    }
    
    console.log('='.repeat(60));
    console.log(`✅ Migration SQL appliquée: ${successCount} commande(s) exécutée(s), ${skipCount} ignorée(s) (déjà existantes)\n`);

    // Vérifier que le champ existe
    console.log('🔍 Vérification du champ seniority_bareme...');
    try {
      const columnExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'payroll_settings'
          AND column_name = 'seniority_bareme'
        ) as exists;
      `;

      if (columnExists[0]?.exists) {
        console.log('   ✅ Champ seniority_bareme existe dans payroll_settings');
      } else {
        console.log('   ⚠️  Champ seniority_bareme n\'existe pas encore');
      }
    } catch (error: any) {
      console.log(`   ⚠️  Impossible de vérifier (non bloquant): ${error.message}`);
    }
    console.log('');

    // Vérifier que seniority_rule_value est nullable
    console.log('🔍 Vérification que seniority_rule_value est nullable...');
    try {
      const isNullable = await prisma.$queryRaw<Array<{ is_nullable: string }>>`
        SELECT is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'payroll_settings'
        AND column_name = 'seniority_rule_value';
      `;

      if (isNullable[0]?.is_nullable === 'YES') {
        console.log('   ✅ Champ seniority_rule_value est nullable');
      } else {
        console.log('   ⚠️  Champ seniority_rule_value n\'est pas nullable');
      }
    } catch (error: any) {
      console.log(`   ⚠️  Impossible de vérifier (non bloquant): ${error.message}`);
    }
    console.log('');

    console.log('========================================');
    console.log('  TERMINE');
    console.log('========================================');

  } catch (error: any) {
    console.error('\n❌ Erreur:', error.message);
    if (error.code) {
      console.error(`   Code: ${error.code}`);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();

