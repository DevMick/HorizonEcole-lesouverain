const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Charger les variables d'environnement depuis .env à la racine
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
  console.log('✅ Variables d\'environnement chargées depuis .env');
} else {
  console.log('⚠️  Fichier .env non trouvé');
}

// Vérifier que DATABASE_URL est définie
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL n\'est pas définie');
  process.exit(1);
}

console.log('🚀 Application de la migration...');

try {
  // Exécuter la migration
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    cwd: __dirname,
    env: process.env
  });
  
  console.log('\n✅ Migration appliquée avec succès !');
  
  // Générer le client Prisma
  console.log('\n📦 Génération du client Prisma...');
  execSync('npx prisma generate', {
    stdio: 'inherit',
    cwd: __dirname,
    env: process.env
  });
  
  console.log('\n✅ Client Prisma généré avec succès !');
  console.log('\n🎉 Migration complète !');
  
} catch (error) {
  console.error('\n❌ Erreur lors de l\'application de la migration:', error.message);
  process.exit(1);
}

