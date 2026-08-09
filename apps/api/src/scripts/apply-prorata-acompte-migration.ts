import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from project root
dotenv.config({ path: join(__dirname, '../../../../.env') });

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('📦 Application de la migration: add_prorata_acompte_config');
    
    const migrationPath = join(__dirname, '../../../../packages/database/prisma/migrations/20250123000000_add_prorata_acompte_config/migration.sql');
    const sql = readFileSync(migrationPath, 'utf-8');
    
    // Split SQL into individual commands
    // Handle DO $$ ... END $$; blocks as single commands
    const commands: string[] = [];
    let currentCommand = '';
    let inDoBlock = false;
    let doBlockDepth = 0;
    
    const lines = sql.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line || line.startsWith('--')) {
        continue; // Skip empty lines and comments
      }
      
      // Check for DO $$ blocks
      if (line.includes('DO $$')) {
        inDoBlock = true;
        doBlockDepth = 1;
        currentCommand = line;
        continue;
      }
      
      if (inDoBlock) {
        currentCommand += '\n' + line;
        
        // Count $$ occurrences to track block depth
        const dollarCount = (line.match(/\$\$/g) || []).length;
        if (dollarCount > 0) {
          doBlockDepth += dollarCount % 2 === 0 ? 0 : (dollarCount === 1 ? 1 : -1);
        }
        
        if (line.includes('END $$;') && doBlockDepth === 0) {
          inDoBlock = false;
          commands.push(currentCommand);
          currentCommand = '';
          continue;
        }
        continue;
      }
      
      currentCommand += (currentCommand ? '\n' : '') + line;
      
      // If line ends with semicolon and we're not in a DO block, it's a complete command
      if (line.endsWith(';') && !inDoBlock) {
        commands.push(currentCommand.trim());
        currentCommand = '';
      }
    }
    
    // Add any remaining command
    if (currentCommand.trim()) {
      commands.push(currentCommand.trim());
    }
    
    console.log(`📝 ${commands.length} commandes SQL à exécuter`);
    
    // Execute commands in order
    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i].trim();
      if (!cmd) continue;
      
      try {
        console.log(`\n⏳ Exécution de la commande ${i + 1}/${commands.length}...`);
        await prisma.$executeRawUnsafe(cmd);
        console.log(`✅ Commande ${i + 1} exécutée avec succès`);
      } catch (error: any) {
        // Ignore "already exists" errors for CREATE TYPE
        if (error.code === '42710' || error.message?.includes('existe déjà') || error.message?.includes('already exists')) {
          console.log(`⚠️  Commande ${i + 1}: ${error.message} (ignoré)`);
          continue;
        }
        
        // Ignore "column already exists" errors
        if (error.code === '42701' || error.message?.includes('déjà existe') || error.message?.includes('already exists')) {
          console.log(`⚠️  Commande ${i + 1}: ${error.message} (ignoré)`);
          continue;
        }
        
        // Ignore "constraint already exists" errors
        if (error.code === '42P16' || error.message?.includes('contrainte') || error.message?.includes('constraint')) {
          console.log(`⚠️  Commande ${i + 1}: ${error.message} (ignoré)`);
          continue;
        }
        
        // Ignore "index already exists" errors
        if (error.code === '42P07' || error.message?.includes('index') || error.message?.includes('index')) {
          console.log(`⚠️  Commande ${i + 1}: ${error.message} (ignoré)`);
          continue;
        }
        
        console.error(`❌ Erreur lors de l'exécution de la commande ${i + 1}:`, error.message);
        throw error;
      }
    }
    
    console.log('\n✅ Migration appliquée avec succès !');
    
  } catch (error: any) {
    console.error('❌ Erreur lors de l\'application de la migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration()
  .then(() => {
    console.log('\n🎉 Migration terminée avec succès !');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erreur fatale:', error);
    process.exit(1);
  });

