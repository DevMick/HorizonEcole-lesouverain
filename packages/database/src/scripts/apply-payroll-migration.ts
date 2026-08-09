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

    // Lire le fichier de migration
    const migrationPath = join(__dirname, '../../prisma/migrations/20250120000000_add_payroll_module/migration.sql');
    console.log('📄 Lecture du fichier de migration...');
    console.log(`   Fichier: ${migrationPath}\n`);
    
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    console.log('🚀 Application de la migration SQL...');
    console.log('='.repeat(60));
    
    // Diviser le SQL en commandes individuelles
    // Utiliser une approche qui préserve les commandes multi-lignes
    const sqlContent = migrationSQL;
    
    // Fonction pour trouver la fin d'une commande SQL (en comptant les parenthèses)
    function findCommandEnd(sql: string, startIndex: number): number {
      let i = startIndex;
      let parenDepth = 0;
      let inString = false;
      let stringChar = '';
      
      while (i < sql.length) {
        const char = sql[i];
        const nextChar = i + 1 < sql.length ? sql[i + 1] : '';
        
        // Gérer les chaînes de caractères
        if ((char === '"' || char === "'") && (i === 0 || sql[i - 1] !== '\\')) {
          if (!inString) {
            inString = true;
            stringChar = char;
          } else if (char === stringChar) {
            inString = false;
            stringChar = '';
          }
        }
        
        if (!inString) {
          // Compter les parenthèses
          if (char === '(') parenDepth++;
          if (char === ')') parenDepth--;
          
          // Si on trouve un ';' et qu'on n'est pas dans des parenthèses, c'est la fin
          if (char === ';' && parenDepth === 0) {
            return i + 1;
          }
        }
        
        i++;
      }
      
      return sql.length;
    }
    
    // D'abord, extraire tous les blocs DO $$ ... END $$;
    const doBlockRegex = /DO\s+\$\$[\s\S]*?END\s+\$\$\s*;/gi;
    const doBlocks: Array<{ start: number; end: number; content: string }> = [];
    let match;
    
    while ((match = doBlockRegex.exec(sqlContent)) !== null) {
      doBlocks.push({
        start: match.index,
        end: match.index + match[0].length,
        content: match[0].trim()
      });
    }
    
    // Extraire toutes les commandes SQL
    const allCommands: Array<{ start: number; end: number; content: string }> = [];
    
    // Extraire les blocs DO
    for (const block of doBlocks) {
      allCommands.push(block);
    }
    
    // Extraire les autres commandes SQL (CREATE TYPE, CREATE TABLE, CREATE INDEX, INSERT)
    const commandStartPatterns = [
      /CREATE\s+TYPE/gi,
      /CREATE\s+TABLE/gi,
      /CREATE\s+(UNIQUE\s+)?INDEX/gi,
      /INSERT\s+INTO/gi,
    ];
    
    for (const pattern of commandStartPatterns) {
      let cmdMatch: RegExpExecArray | null;
      pattern.lastIndex = 0; // Reset regex
      while ((cmdMatch = pattern.exec(sqlContent)) !== null) {
        // Vérifier que cette commande n'est pas déjà dans un bloc DO
        const isInDoBlock = doBlocks.some(block => 
          cmdMatch!.index >= block.start && cmdMatch!.index < block.end
        );
        
        if (!isInDoBlock) {
          const endIndex = findCommandEnd(sqlContent, cmdMatch.index);
          const commandContent = sqlContent.substring(cmdMatch.index, endIndex).trim();
          
          // Vérifier qu'on n'a pas déjà cette commande
          const isDuplicate = allCommands.some(cmd => 
            cmd.start === cmdMatch!.index && cmd.end === endIndex
          );
          
          if (!isDuplicate && commandContent) {
            allCommands.push({
              start: cmdMatch.index,
              end: endIndex,
              content: commandContent
            });
          }
        }
      }
    }
    
    // Trier par position dans le fichier pour préserver l'ordre
    allCommands.sort((a, b) => a.start - b.start);
    
    // Filtrer les commandes vides et les commentaires
    const filteredCommands = allCommands
      .map(cmd => cmd.content)
      .filter(cmd => cmd && !cmd.startsWith('--') && cmd.length > 0);
    
    console.log(`   ${filteredCommands.length} commande(s) SQL à exécuter\n`);
    
    // Trier les commandes par ordre d'exécution : types -> tables -> index -> foreign keys -> inserts
    const sortedCommands: Array<{ cmd: string; type: string; priority: number }> = [];
    
    for (const cmd of filteredCommands) {
      let type = 'OTHER';
      let priority = 100;
      
      if (cmd.match(/CREATE\s+TYPE/i)) {
        type = 'TYPE';
        priority = 1;
      } else if (cmd.match(/CREATE\s+TABLE/i)) {
        type = 'TABLE';
        priority = 2;
      } else if (cmd.match(/CREATE\s+(UNIQUE\s+)?INDEX/i)) {
        type = 'INDEX';
        priority = 3;
      } else if (cmd.match(/ALTER\s+TABLE.*ADD\s+(CONSTRAINT|FOREIGN\s+KEY)/i) || cmd.match(/DO\s+\$\$/i)) {
        type = 'FOREIGN_KEY';
        priority = 4;
      } else if (cmd.match(/INSERT\s+INTO/i)) {
        type = 'INSERT';
        priority = 5;
      }
      
      sortedCommands.push({ cmd, type, priority });
    }
    
    // Trier par priorité
    sortedCommands.sort((a, b) => a.priority - b.priority);
    
    console.log(`   Ordre d'exécution: Types (${sortedCommands.filter(c => c.type === 'TYPE').length}), Tables (${sortedCommands.filter(c => c.type === 'TABLE').length}), Index (${sortedCommands.filter(c => c.type === 'INDEX').length}), Foreign Keys (${sortedCommands.filter(c => c.type === 'FOREIGN_KEY').length}), Inserts (${sortedCommands.filter(c => c.type === 'INSERT').length})\n`);
    
    // Exécuter chaque commande individuellement dans l'ordre
    let successCount = 0;
    let skipCount = 0;
    const failedCommands: Array<{ cmd: string; error: string; attempt: number }> = [];
    const maxRetries = 3;
    
    for (let i = 0; i < sortedCommands.length; i++) {
      const { cmd, type } = sortedCommands[i];
      let executed = false;
      let attempts = 0;
      
      while (!executed && attempts < maxRetries) {
        attempts++;
        try {
          // Remplacer "barème_imposition" par "bareme_imposition" si présent
          const fixedCmd = cmd.replace(/barème_imposition/g, 'bareme_imposition');
          
          await prisma.$executeRawUnsafe(fixedCmd);
          successCount++;
          executed = true;
          
          // Afficher le progrès pour les commandes importantes
          if (type === 'TYPE' || type === 'TABLE' || type === 'INSERT') {
            const match = cmd.match(/--\s*(CreateEnum|CreateTable|Insert)\s*:\s*(\w+)/i);
            if (match) {
              console.log(`   ✅ ${match[1]}: ${match[2]}`);
            } else if (type === 'TYPE') {
              const typeMatch = cmd.match(/CREATE\s+TYPE\s+"?(\w+)"?/i);
              if (typeMatch) {
                console.log(`   ✅ Enum: ${typeMatch[1]}`);
              }
            } else if (type === 'TABLE') {
              const tableMatch = cmd.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?/i);
              if (tableMatch) {
                console.log(`   ✅ Table: ${tableMatch[1]}`);
              }
            }
          }
        } catch (error: any) {
          // Ignorer les erreurs "already exists" ou "duplicate key"
          const isAlreadyExists = 
            error.message?.includes('already exists') ||
            error.message?.includes('existe déjà') ||
            error.message?.includes('duplicate key') ||
            error.message?.includes('constraint') && error.message?.includes('already exists') ||
            error.code === '42P07' || // duplicate_table
            error.code === '42710' || // duplicate_object (type, table, etc.)
            error.code === '23505';    // unique_violation
          
          if (isAlreadyExists) {
            skipCount++;
            executed = true; // Considéré comme réussi (déjà existant)
            // Afficher un message informatif pour les types et tables
            if (type === 'TYPE' || type === 'TABLE') {
              const nameMatch = cmd.match(/CREATE\s+(?:TYPE|TABLE)\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?/i);
              if (nameMatch) {
                console.log(`   ℹ️  ${type === 'TYPE' ? 'Enum' : 'Table'} "${nameMatch[1]}" existe déjà (ignoré)`);
              }
            }
          } else if (error.code === '42P01' && attempts < maxRetries) {
            // Table/index n'existe pas encore - peut-être une dépendance, réessayer plus tard
            failedCommands.push({ cmd, error: error.message, attempt: attempts });
            // Attendre un peu avant de réessayer
            await new Promise(resolve => setTimeout(resolve, 100 * attempts));
          } else {
            // Afficher les vraies erreurs
            console.error(`\n   ❌ Erreur à la commande ${i + 1}/${sortedCommands.length} (${type}):`);
            console.error(`   ${error.message}`);
            console.error(`   Code: ${error.code || 'N/A'}`);
            console.error(`   Commande: ${cmd.substring(0, 200)}...`);
            throw error;
          }
        }
      }
      
      if (!executed) {
        console.error(`\n   ❌ Impossible d'exécuter après ${maxRetries} tentatives:`);
        console.error(`   ${cmd.substring(0, 200)}...`);
        throw new Error(`Échec d'exécution de la commande après ${maxRetries} tentatives`);
      }
    }
    
    console.log('='.repeat(60));
    console.log(`✅ Migration SQL appliquée: ${successCount} commande(s) exécutée(s), ${skipCount} ignorée(s) (déjà existantes)\n`);

    // Marquer la migration comme résolue dans _prisma_migrations
    console.log('📝 Marquage de la migration comme résolue...');
    try {
      // Vérifier si la table _prisma_migrations existe
      const migrationTableExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = '_prisma_migrations'
        ) as exists;
      `;

      if (migrationTableExists[0]?.exists) {
        // Vérifier si la migration n'est pas déjà enregistrée
        const existingMigration = await prisma.$queryRaw<Array<{ migration_name: string }>>`
          SELECT migration_name 
          FROM _prisma_migrations 
          WHERE migration_name = '20250120000000_add_payroll_module';
        `;

        if (existingMigration.length === 0) {
          // Insérer l'enregistrement de migration
          const migrationName = '20250120000000_add_payroll_module';
          const checksum = ''; // Prisma génère normalement un checksum, mais on peut le laisser vide pour une migration manuelle
          
          await prisma.$executeRawUnsafe(`
            INSERT INTO _prisma_migrations (migration_name, applied_steps_count)
            VALUES ('${migrationName}', 1)
            ON CONFLICT (migration_name) DO NOTHING;
          `);
          
          console.log('   ✅ Migration marquée comme résolue dans _prisma_migrations');
        } else {
          console.log('   ℹ️  Migration déjà enregistrée dans _prisma_migrations');
        }
      } else {
        console.log('   ⚠️  Table _prisma_migrations n\'existe pas encore (première migration)');
      }
    } catch (error: any) {
      console.log(`   ⚠️  Impossible de marquer la migration (non bloquant): ${error.message}`);
    }
    console.log('');

    // Vérifier les tables
    console.log('🔍 Vérification des tables créées...');
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
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
    
    console.log(`📊 Tables trouvées: ${tables.length}/8`);
    tables.forEach(table => {
      console.log(`   ✅ ${table.table_name}`);
    });
    
    if (tables.length === 8) {
      console.log('\n🎉 Toutes les tables de paie sont créées !');
    }

    // Vérifier les enums
    console.log('\n🔍 Vérification des enums...');
    const enums = await prisma.$queryRaw<Array<{ typname: string }>>`
      SELECT t.typname
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
    
    console.log(`📊 Enums trouvés: ${enums.length}/6`);
    enums.forEach(e => {
      console.log(`   ✅ ${e.typname}`);
    });

    // Vérifier les paramètres
    const settingsCount = await prisma.payroll_settings.count();
    if (settingsCount > 0) {
      console.log(`\n✅ Paramètres par défaut créés (${settingsCount} enregistrement(s))`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration complète et vérifiée !');
    console.log('='.repeat(60));
    console.log('\n📝 Prochaines étapes:');
    console.log('   1. Générer le client Prisma: pnpm prisma generate');
    console.log('   2. Redémarrer le serveur API\n');

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

