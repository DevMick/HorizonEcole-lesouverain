/**
 * Script de test pour diagnostiquer le problème de remplissage du formulaire d'inscription
 * 
 * Instructions d'utilisation:
 * 1. Ouvrez la page http://localhost:5173/academic/inscriptions
 * 2. Ouvrez la console du navigateur (F12)
 * 3. Copiez-collez ce script dans la console
 * 4. Le script va automatiquement tester le formulaire d'édition
 */

(function testInscriptionForm() {
  console.log('=== DÉBUT DU TEST DU FORMULAIRE D\'INSCRIPTION ===\n');

  // Fonction pour attendre un certain temps
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Fonction pour trouver le premier bouton d'édition
  const findEditButton = () => {
    const buttons = document.querySelectorAll('button[title="Modifier"], button .anticon-edit');
    for (let btn of buttons) {
      // Si c'est l'icône, remonter au bouton parent
      if (btn.classList.contains('anticon-edit')) {
        btn = btn.closest('button');
      }
      if (btn) return btn;
    }
    return null;
  };

  // Fonction pour obtenir les données de l'inscription depuis le tableau
  const getInscriptionDataFromTable = () => {
    // Chercher dans le tableau les données de la première ligne
    const rows = document.querySelectorAll('.ant-table-tbody tr');
    if (rows.length === 0) {
      console.error('❌ Aucune ligne trouvée dans le tableau');
      return null;
    }

    const firstRow = rows[0];
    const cells = firstRow.querySelectorAll('td');
    
    // Extraire les informations visibles
    const studentName = firstRow.querySelector('strong')?.textContent || '';
    console.log('📋 Nom de l\'élève trouvé dans le tableau:', studentName);

    return {
      studentName,
      row: firstRow
    };
  };

  // Fonction pour vérifier les valeurs du formulaire
  const checkFormValues = () => {
    console.log('\n=== VÉRIFICATION DES VALEURS DU FORMULAIRE ===');
    
    const formFields = {
      studentFirstName: {
        selector: 'input[placeholder="Prénom"]',
        name: 'Prénom de l\'élève'
      },
      studentLastName: {
        selector: 'input[placeholder="Nom"]',
        name: 'Nom de l\'élève'
      },
      studentBirthPlace: {
        selector: 'input[placeholder="Lieu de naissance"]',
        name: 'Lieu de naissance'
      },
      parentFirstName: {
        selector: 'input[placeholder="Prénom"]',
        name: 'Prénom du parent',
        index: 0 // Premier input avec placeholder "Prénom" (élève)
      },
      parentLastName: {
        selector: 'input[placeholder="Nom"]',
        name: 'Nom du parent',
        index: 0 // Premier input avec placeholder "Nom" (élève)
      }
    };

    // Vérifier chaque champ
    Object.entries(formFields).forEach(([key, config]) => {
      let inputs;
      if (key === 'parentFirstName') {
        // Pour le prénom du parent, on cherche le 2ème input avec placeholder "Prénom"
        inputs = Array.from(document.querySelectorAll('input[placeholder="Prénom"]'));
        inputs = inputs.length > 1 ? [inputs[1]] : [];
      } else if (key === 'parentLastName') {
        // Pour le nom du parent, on cherche le 2ème input avec placeholder "Nom"
        inputs = Array.from(document.querySelectorAll('input[placeholder="Nom"]'));
        inputs = inputs.length > 1 ? [inputs[1]] : [];
      } else {
        inputs = Array.from(document.querySelectorAll(config.selector));
      }

      if (inputs.length === 0) {
        console.warn(`⚠️  ${config.name}: Champ non trouvé dans le DOM`);
        return;
      }

      const input = inputs[0];
      const value = input.value;
      const hasValue = value && value.trim().length > 0;

      if (hasValue) {
        console.log(`✅ ${config.name}: "${value}"`);
      } else {
        console.error(`❌ ${config.name}: VIDE ou non défini`);
        console.log(`   - Input trouvé:`, input);
        console.log(`   - Valeur brute:`, value);
        console.log(`   - Attribut value:`, input.getAttribute('value'));
        console.log(`   - Propriétés de l'input:`, {
          value: input.value,
          defaultValue: input.defaultValue,
          name: input.name,
          id: input.id
        });
      }
    });

    // Vérifier aussi via l'API Ant Design Form si disponible
    console.log('\n=== VÉRIFICATION VIA L\'ÉTAT DU FORMULAIRE ===');
    const modal = document.querySelector('.ant-modal');
    if (modal) {
      // Chercher le formulaire Ant Design
      const form = modal.querySelector('form');
      if (form) {
        console.log('✅ Formulaire trouvé dans le modal');
        
        // Essayer d'accéder aux valeurs via les data-attributes ou autres
        const allInputs = modal.querySelectorAll('input');
        console.log(`📊 Nombre total d'inputs dans le formulaire: ${allInputs.length}`);
        
        allInputs.forEach((input, index) => {
          if (input.value) {
            console.log(`  Input ${index + 1}: placeholder="${input.placeholder}" value="${input.value}"`);
          }
        });
      }
    }
  };

  // Fonction principale de test
  const runTest = async () => {
    try {
      // Vérification préalable: URL et authentification
      const currentUrl = window.location.href;
      if (currentUrl.includes('/login')) {
        console.error('❌ Vous devez d\'abord vous connecter!');
        console.log('💡 Instructions:');
        console.log('   1. Connectez-vous avec vos identifiants');
        console.log('   2. Naviguez vers http://localhost:5173/academic/inscriptions');
        console.log('   3. Réexécutez ce script');
        return;
      }
      
      if (!currentUrl.includes('/inscriptions')) {
        console.warn('⚠️  Vous n\'êtes pas sur la page d\'inscriptions');
        console.log('💡 Naviguez vers http://localhost:5173/academic/inscriptions puis réexécutez ce script');
        return;
      }
      
      // Étape 1: Trouver le bouton d'édition
      console.log('🔍 Étape 1: Recherche du bouton d\'édition...');
      const editButton = findEditButton();
      
      if (!editButton) {
        console.error('❌ Bouton d\'édition non trouvé!');
        console.log('💡 Assurez-vous qu\'il y a au moins une inscription dans le tableau');
        return;
      }

      console.log('✅ Bouton d\'édition trouvé:', editButton);

      // Étape 2: Obtenir les données de l'inscription
      console.log('\n🔍 Étape 2: Extraction des données de l\'inscription...');
      const inscriptionData = getInscriptionDataFromTable();
      
      // Étape 3: Cliquer sur le bouton d'édition
      console.log('\n🔍 Étape 3: Clic sur le bouton d\'édition...');
      editButton.click();
      
      // Attendre que le modal s'ouvre
      await wait(500);
      
      // Vérifier si le modal est ouvert
      const modal = document.querySelector('.ant-modal-open');
      if (!modal) {
        console.error('❌ Le modal ne s\'est pas ouvert!');
        return;
      }
      
      console.log('✅ Modal ouvert');

      // Étape 4: Attendre que le formulaire soit rempli
      console.log('\n🔍 Étape 4: Attente du remplissage du formulaire...');
      await wait(1000); // Attendre 1 seconde pour que le useEffect s'exécute

      // Étape 5: Vérifier les valeurs
      checkFormValues();

      // Étape 6: Vérifier les logs de la console pour les données brutes
      console.log('\n=== INSTRUCTIONS POUR VÉRIFICATION MANUELLE ===');
      console.log('1. Vérifiez les logs précédents dans la console qui commencent par "=== handleEdit START ==="');
      console.log('2. Vérifiez les logs "useEffect: Setting form values:"');
      console.log('3. Vérifiez les logs "Form values after setFieldsValue:"');
      console.log('4. Comparez les valeurs dans ces logs avec les valeurs affichées dans les inputs');

      // Étape 7: Test supplémentaire - Essayer de définir manuellement une valeur
      console.log('\n=== TEST SUPPLÉMENTAIRE: Définition manuelle ===');
      const testInput = document.querySelector('input[placeholder="Prénom"]');
      if (testInput) {
        console.log('🧪 Test: Définition manuelle de "TEST" dans le premier champ Prénom...');
        testInput.value = 'TEST';
        testInput.dispatchEvent(new Event('input', { bubbles: true }));
        testInput.dispatchEvent(new Event('change', { bubbles: true }));
        await wait(100);
        console.log(`   Valeur après définition manuelle: "${testInput.value}"`);
        if (testInput.value === 'TEST') {
          console.log('   ✅ L\'input accepte les valeurs manuellement');
        } else {
          console.log('   ⚠️  L\'input ne conserve pas la valeur (peut être contrôlé par Ant Design Form)');
        }
      }

      console.log('\n=== FIN DU TEST ===');
      console.log('\n💡 Si des champs sont vides, vérifiez:');
      console.log('   1. Les logs "Raw inscription data" pour voir les données brutes');
      console.log('   2. Les logs "Form values after setFieldsValue" pour voir ce qui a été défini');
      console.log('   3. Comparez les noms de propriétés (camelCase vs snake_case)');

    } catch (error) {
      console.error('❌ Erreur pendant le test:', error);
      console.error('Stack trace:', error.stack);
    }
  };

  // Démarrer le test
  runTest();
})();

