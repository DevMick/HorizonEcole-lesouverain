/**
 * Script pour récupérer les détails exacts des paramètres de paie
 */

import dotenv from 'dotenv';
import path from 'path';
import { prisma } from '@school/database';

// Charger les variables d'environnement
const possibleEnvPaths = [
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../../../.env'),
];

for (const envPath of possibleEnvPaths) {
  dotenv.config({ path: envPath });
  if (process.env.DATABASE_URL) {
    break;
  }
}

async function getSettings() {
  try {
    const settings = await prisma.payroll_settings.findFirst();
    
    if (!settings) {
      console.log('❌ Aucun paramètre de paie trouvé');
      return;
    }

    console.log('========================================');
    console.log('Paramètres de Paie Globaux');
    console.log('========================================');
    console.log('');
    console.log('📋 Génération Mensuelle :');
    console.log(`   - Jour de calcul : ${settings.date_calcul_mensuel}`);
    console.log(`   - Nombre de semaines par mois : ${Number(settings.nombre_semaines_par_mois)}`);
    console.log('');
    console.log('📋 Règles d\'Ancienneté :');
    console.log(`   - Type : ${settings.seniority_rule_type}`);
    console.log(`   - Valeur : ${settings.seniority_rule_value || 'N/A'}`);
    if (settings.seniority_bareme) {
      const bareme = settings.seniority_bareme as any;
      if (Array.isArray(bareme)) {
        console.log(`   - Barème (${bareme.length} palier(s)) :`);
        bareme.forEach((palier: any, index: number) => {
          console.log(`     Palier ${index + 1} : ${palier.minYears} à ${palier.maxYears || '∞'} ans → ${palier.percentage}%`);
        });
      }
    }
    console.log('');
    console.log('📋 Prorata :');
    console.log(`   - Activé : ${settings.prorata_enabled ? 'Oui' : 'Non'}`);
    console.log(`   - Méthode de base : ${settings.prorata_basis}`);
    console.log(`   - Méthode jours du mois : ${settings.prorata_days_in_month_method}`);
    console.log(`   - Arrondi : ${settings.prorata_rounding}`);
    console.log(`   - Inclure primes : ${settings.prorata_include_primes ? 'Oui' : 'Non'}`);
    console.log('');
    console.log('📋 Acomptes :');
    console.log(`   - Activé : ${settings.acompte_enabled ? 'Oui' : 'Non'}`);
    console.log(`   - Plafond % : ${settings.acompte_max_pct_per_month ? Number(settings.acompte_max_pct_per_month) + '%' : 'N/A'}`);
    console.log(`   - Plafond montant : ${settings.acompte_max_amount_per_request ? Number(settings.acompte_max_amount_per_request).toLocaleString() + ' FCFA' : 'N/A'}`);
    console.log(`   - Déduction automatique : ${settings.acompte_auto_apply_to_payroll ? 'Oui' : 'Non'}`);
    console.log('');
    console.log('📋 Cotisations et Impôts :');
    console.log(`   - Assiette imposable : ${settings.assiette_imposable}`);
    console.log(`   - CNPS activé : ${settings.calcul_cnps_actif ? 'Oui' : 'Non'}`);
    console.log(`   - Taux CNPS salarié : ${settings.taux_cnps_salarie ? Number(settings.taux_cnps_salarie) + '%' : 'N/A'}`);
    console.log(`   - Taux CNPS employeur : ${settings.taux_cnps_employeur ? Number(settings.taux_cnps_employeur) + '%' : 'N/A'}`);
    console.log(`   - IGR activé : ${settings.calcul_igr_actif ? 'Oui' : 'Non'}`);
    if (settings.bareme_imposition) {
      const bareme = settings.bareme_imposition as any;
      if (Array.isArray(bareme)) {
        console.log(`   - Barème IGR (${bareme.length} tranche(s)) :`);
        bareme.forEach((tranche: any, index: number) => {
          console.log(`     Tranche ${index + 1} : ${tranche.minAmount.toLocaleString()} à ${tranche.maxAmount ? tranche.maxAmount.toLocaleString() : '∞'} FCFA → ${tranche.rate}%`);
        });
      }
    }
    console.log('');

  } catch (error: any) {
    console.error('❌ Erreur :', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

getSettings()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Erreur fatale :', error);
    process.exit(1);
  });

