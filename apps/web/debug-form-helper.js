/**
 * Helper de débogage pour le formulaire d'inscription
 * 
 * Ce script peut être copié dans la console pour créer des fonctions
 * de débogage globales qui peuvent être appelées à tout moment.
 */

// Créer un objet global pour les fonctions de débogage
window.debugInscriptionForm = {
  
  /**
   * Affiche toutes les valeurs du formulaire
   */
  showFormValues: function() {
    const modal = document.querySelector('.ant-modal-open, .ant-modal');
    if (!modal) {
      console.error('❌ Aucun modal ouvert');
      return;
    }

    const form = modal.querySelector('form');
    if (!form) {
      console.error('❌ Formulaire non trouvé');
      return;
    }

    console.log('=== VALEURS DU FORMULAIRE ===');
    const inputs = modal.querySelectorAll('input[type="text"], input[type="date"]');
    inputs.forEach(input => {
      if (input.placeholder) {
        console.log(`${input.placeholder}: "${input.value || '(vide)'}"`);
      }
    });
  },

  /**
   * Affiche les données de l'inscription en cours d'édition
   * (nécessite React DevTools)
   */
  showEditingInscription: function() {
    console.log('=== DONNÉES DE L\'INSCRIPTION ===');
    console.log('Pour voir les données, utilisez React DevTools:');
    console.log('1. Ouvrez React DevTools');
    console.log('2. Sélectionnez InscriptionsPage');
    console.log('3. Cherchez editingInscription dans les props/state');
  },

  /**
   * Force la définition d'une valeur dans un champ spécifique
   */
  setFieldValue: function(fieldName, value) {
    const modal = document.querySelector('.ant-modal-open, .ant-modal');
    if (!modal) {
      console.error('❌ Aucun modal ouvert');
      return;
    }

    // Trouver le champ par son placeholder ou name
    let input = null;
    
    // Essayer par placeholder
    const placeholders = {
      'studentFirstName': 'Prénom',
      'studentLastName': 'Nom',
      'studentBirthPlace': 'Lieu de naissance',
      'parentFirstName': 'Prénom',
      'parentLastName': 'Nom'
    };

    const placeholder = placeholders[fieldName];
    if (placeholder) {
      const inputs = Array.from(modal.querySelectorAll(`input[placeholder="${placeholder}"]`));
      if (fieldName === 'parentFirstName' && inputs.length > 1) {
        input = inputs[1]; // 2ème input avec placeholder "Prénom"
      } else if (fieldName === 'parentLastName' && inputs.length > 1) {
        input = inputs[1]; // 2ème input avec placeholder "Nom"
      } else {
        input = inputs[0];
      }
    }

    if (!input) {
      // Essayer par name
      input = modal.querySelector(`input[name="${fieldName}"]`);
    }

    if (!input) {
      console.error(`❌ Champ "${fieldName}" non trouvé`);
      return;
    }

    console.log(`🔧 Définition de ${fieldName} à "${value}"...`);
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    console.log(`✅ Valeur définie. Nouvelle valeur: "${input.value}"`);
  },

  /**
   * Compare les données de l'inscription avec les valeurs du formulaire
   */
  compareData: function(inscriptionData) {
    if (!inscriptionData) {
      console.error('❌ Aucune donnée fournie');
      console.log('💡 Utilisez: debugInscriptionForm.compareData({studentFirstName: "Rahim", ...})');
      return;
    }

    console.log('=== COMPARAISON DES DONNÉES ===\n');
    
    const modal = document.querySelector('.ant-modal-open, .ant-modal');
    if (!modal) {
      console.error('❌ Aucun modal ouvert');
      return;
    }

    const comparisons = [
      { key: 'studentFirstName', placeholder: 'Prénom', index: 0 },
      { key: 'studentLastName', placeholder: 'Nom', index: 0 },
      { key: 'studentBirthPlace', placeholder: 'Lieu de naissance', index: 0 },
      { key: 'parentFirstName', placeholder: 'Prénom', index: 1 },
      { key: 'parentLastName', placeholder: 'Nom', index: 1 }
    ];

    comparisons.forEach(({ key, placeholder, index }) => {
      const expectedValue = inscriptionData[key] || inscriptionData[key.replace(/([A-Z])/g, '_$1').toLowerCase()] || '(non défini)';
      const inputs = Array.from(modal.querySelectorAll(`input[placeholder="${placeholder}"]`));
      const input = inputs[index];
      const actualValue = input?.value || '(vide)';

      console.log(`${key}:`);
      console.log(`  Attendu: "${expectedValue}"`);
      console.log(`  Actuel:  "${actualValue}"`);
      
      if (expectedValue !== actualValue && actualValue !== '(vide)') {
        console.log(`  ⚠️  DIFFÉRENT`);
      } else if (actualValue === '(vide)') {
        console.log(`  ❌ VIDE`);
      } else {
        console.log(`  ✅ CORRECT`);
      }
      console.log('');
    });
  },

  /**
   * Affiche toutes les informations de débogage
   */
  fullDebug: function() {
    console.log('=== DÉBOGAGE COMPLET ===\n');
    this.showFormValues();
    console.log('\n');
    this.showEditingInscription();
    console.log('\n💡 Utilisez aussi:');
    console.log('   - debugInscriptionForm.setFieldValue("studentFirstName", "Test")');
    console.log('   - debugInscriptionForm.compareData({...})');
  }
};

// Afficher les instructions
console.log('✅ Fonctions de débogage chargées!');
console.log('\n📚 Commandes disponibles:');
console.log('   debugInscriptionForm.showFormValues() - Affiche les valeurs du formulaire');
console.log('   debugInscriptionForm.setFieldValue("studentFirstName", "Test") - Force une valeur');
console.log('   debugInscriptionForm.compareData({...}) - Compare données vs formulaire');
console.log('   debugInscriptionForm.fullDebug() - Affiche toutes les infos');
console.log('\n💡 Exemple:');
console.log('   debugInscriptionForm.setFieldValue("studentFirstName", "Rahim");');

