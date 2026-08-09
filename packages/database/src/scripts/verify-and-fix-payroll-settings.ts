import { config } from 'dotenv';
import { prisma } from '../index';
import { join } from 'path';

// Charger les variables d'environnement depuis la racine du projet
config({ path: join(__dirname, '../../../.env') });

async function verifyAndFix() {
  try {
    console.log('🔌 Connexion à la base de données...');
    await prisma.$connect();
    console.log('✅ Connecté\n');

    // Vérifier la structure de la table payroll_settings
    console.log('🔍 Vérification de la structure de payroll_settings...\n');
    
    const columns = await prisma.$queryRaw<Array<{ column_name: string; data_type: string; is_nullable: string }>>`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'payroll_settings'
      ORDER BY ordinal_position;
    `;

    console.log('Colonnes trouvées dans payroll_settings:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });
    console.log('');

    // Vérifier spécifiquement seniority_bareme
    const hasSeniorityBareme = columns.some(col => col.column_name === 'seniority_bareme');
    const hasSeniorityRuleValue = columns.some(col => col.column_name === 'seniority_rule_value');
    
    if (!hasSeniorityBareme) {
      console.log('❌ Le champ seniority_bareme n\'existe pas !');
      console.log('   Application de la migration...\n');
      
      // Ajouter le champ
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "payroll_settings" 
        ADD COLUMN IF NOT EXISTS "seniority_bareme" JSONB;
      `);
      console.log('   ✅ Champ seniority_bareme ajouté');
    } else {
      console.log('✅ Le champ seniority_bareme existe');
    }

    // Vérifier que seniority_rule_value est nullable
    const seniorityRuleValueCol = columns.find(col => col.column_name === 'seniority_rule_value');
    if (seniorityRuleValueCol && seniorityRuleValueCol.is_nullable === 'NO') {
      console.log('⚠️  Le champ seniority_rule_value n\'est pas nullable');
      console.log('   Modification...\n');
      
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "payroll_settings" 
        ALTER COLUMN "seniority_rule_value" DROP NOT NULL;
      `);
      console.log('   ✅ Champ seniority_rule_value rendu nullable');
    } else {
      console.log('✅ Le champ seniority_rule_value est nullable');
    }

    console.log('\n🔍 Test de lecture des paramètres...');
    try {
      const settings = await prisma.payroll_settings.findFirst();
      if (settings) {
        console.log('✅ Lecture réussie !');
        console.log(`   ID: ${settings.id}`);
        console.log(`   Type règle ancienneté: ${settings.seniority_rule_type}`);
        console.log(`   Barème: ${settings.seniority_bareme ? JSON.stringify(settings.seniority_bareme) : 'null'}`);
      } else {
        console.log('ℹ️  Aucun paramètre trouvé (normal si première utilisation)');
      }
    } catch (error: any) {
      console.error('❌ Erreur lors de la lecture:', error.message);
      console.error('   Code:', error.code);
      throw error;
    }

    console.log('\n========================================');
    console.log('  VERIFICATION TERMINEE');
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

verifyAndFix();

