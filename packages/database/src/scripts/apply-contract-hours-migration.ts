import { config } from 'dotenv';
import { prisma } from '../index';
import { readFileSync } from 'fs';
import { join } from 'path';

// Charger les variables d'environnement depuis la racine du projet
const envPath = join(__dirname, '../../../../.env');
config({ path: envPath });

async function applyMigration() {
  try {
    console.log('🔌 Connexion à la base de données...');
    await prisma.$connect();
    console.log('✅ Connecté\n');

    const migrationPath = join(__dirname, '../../prisma/migrations/20250122000000_add_contract_end_date_and_teacher_hours/migration.sql');
    console.log('📄 Lecture du fichier de migration...');
    console.log(`   Fichier: ${migrationPath}\n`);
    
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    console.log('🚀 Application de la migration SQL...');
    console.log('='.repeat(60));
    
    // Parser le SQL en commandes individuelles (gérer les blocs DO $$ ... END $$;)
    const commands: string[] = [];
    let currentCommand = '';
    let inDoBlock = false;
    
    // Diviser par lignes pour mieux gérer les blocs DO $$
    const lines = migrationSQL.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Ignorer les commentaires seuls
      if (trimmedLine.startsWith('--') && !trimmedLine.includes(';')) {
        continue;
      }
      
      // Détecter le début d'un bloc DO $$
      if (trimmedLine.match(/^DO\s+\$\$/i)) {
        inDoBlock = true;
        currentCommand = trimmedLine + '\n';
        continue;
      }
      
      // Si on est dans un bloc DO, accumuler jusqu'à END $$
      if (inDoBlock) {
        currentCommand += line + '\n';
        
        // Détecter la fin du bloc DO (END $$;)
        if (trimmedLine.match(/END\s+\$\$\s*;?/i)) {
          inDoBlock = false;
          if (currentCommand.trim()) {
            commands.push(currentCommand.trim());
          }
          currentCommand = '';
          continue;
        }
        continue;
      }
      
      // Commandes normales
      currentCommand += line + '\n';
      
      // Si la ligne se termine par ; et qu'on n'est pas dans un bloc DO
      if (trimmedLine.endsWith(';') && !inDoBlock) {
        const cmd = currentCommand.trim();
        if (cmd && !cmd.startsWith('--')) {
          commands.push(cmd);
        }
        currentCommand = '';
      }
    }
    
    // Ajouter la dernière commande si elle existe
    if (currentCommand.trim() && !currentCommand.trim().startsWith('--')) {
      commands.push(currentCommand.trim());
    }
    
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
          error.message?.includes('duplicate_table') ||
          error.code === '42701' || // duplicate_column
          error.code === '42P07' ||  // duplicate_table
          error.code === '42710'     // duplicate_object (enum, etc.)
        ) {
          skipCount++;
          console.log(`   ℹ️  Commande ${i + 1}/${commands.length} ignorée (déjà existante)`);
        } else {
          console.error(`\n   ❌ Erreur à la commande ${i + 1}/${commands.length}:`);
          console.error(`   ${error.message}`);
          console.error(`   Code: ${error.code || 'N/A'}`);
          console.error(`   Commande problématique:`);
          console.error(`   ${cmd.substring(0, 200)}...`);
          throw error;
        }
      }
    }
    
    console.log('='.repeat(60));
    console.log(`✅ Migration SQL appliquée: ${successCount} commande(s) exécutée(s), ${skipCount} ignorée(s) (déjà existantes)\n`);

    // Vérifier que les champs existent
    console.log('🔍 Vérification des champs...');
    try {
      const endDateExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'teachers'
          AND column_name = 'end_date'
        ) as exists;
      `;

      if (endDateExists[0]?.exists) {
        console.log('   ✅ Champ end_date existe dans teachers');
      } else {
        console.log('   ⚠️  Champ end_date n\'existe pas encore');
      }

      const teacherHoursExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'teacher_hours'
        ) as exists;
      `;

      if (teacherHoursExists[0]?.exists) {
        console.log('   ✅ Table teacher_hours existe');
      } else {
        console.log('   ⚠️  Table teacher_hours n\'existe pas encore');
      }

      const prorataFieldsExist = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'monthly_payrolls'
        AND column_name IN ('prorata_amount', 'prorata_days', 'prorata_total_days');
      `;

      if (prorataFieldsExist.length === 3) {
        console.log('   ✅ Champs prorata existent dans monthly_payrolls');
      } else {
        console.log(`   ⚠️  Seulement ${prorataFieldsExist.length}/3 champs prorata existent`);
      }
    } catch (error: any) {
      console.log(`   ⚠️  Impossible de vérifier (non bloquant): ${error.message}`);
    }
    console.log('');

    console.log('========================================');
    console.log('  TERMINE');
    console.log('========================================');
    console.log('');
    console.log('💡 Exécutez maintenant: pnpm --filter @school/database generate');
    console.log('   Puis redémarrez le serveur API');

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
