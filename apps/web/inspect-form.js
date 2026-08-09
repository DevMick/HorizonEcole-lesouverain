/**
 * Script simple pour inspecter l'état du formulaire d'inscription
 * 
 * Instructions:
 * 1. Ouvrez le modal d'édition d'une inscription
 * 2. Copiez-collez ce script dans la console
 * 3. Le script affichera toutes les informations sur l'état du formulaire
 */

(function inspectForm() {
  console.log('=== INSPECTION DU FORMULAIRE D\'INSCRIPTION ===\n');

  // Trouver le modal
  const modal = document.querySelector('.ant-modal-open, .ant-modal');
  if (!modal) {
    console.error('❌ Aucun modal trouvé. Veuillez ouvrir le modal d\'édition d\'abord.');
    return;
  }

  console.log('✅ Modal trouvé\n');

  // Trouver tous les inputs
  const inputs = modal.querySelectorAll('input');
  console.log(`📊 Nombre d'inputs trouvés: ${inputs.length}\n`);

  // Inspecter chaque input
  inputs.forEach((input, index) => {
    const placeholder = input.placeholder || 'N/A';
    const value = input.value || '(vide)';
    const name = input.name || input.getAttribute('name') || 'N/A';
    const id = input.id || 'N/A';
    
    console.log(`Input ${index + 1}:`);
    console.log(`  Placeholder: "${placeholder}"`);
    console.log(`  Value: "${value}"`);
    console.log(`  Name: "${name}"`);
    console.log(`  ID: "${id}"`);
    console.log(`  Type: ${input.type}`);
    console.log(`  Classe: ${input.className}`);
    console.log('');
  });

  // Trouver tous les Select
  const selects = modal.querySelectorAll('.ant-select');
  console.log(`📊 Nombre de Select trouvés: ${selects.length}\n`);

  selects.forEach((select, index) => {
    const label = select.closest('.ant-form-item')?.querySelector('label')?.textContent || 'N/A';
    const selectedValue = select.querySelector('.ant-select-selection-item')?.textContent || '(non sélectionné)';
    
    console.log(`Select ${index + 1}:`);
    console.log(`  Label: "${label}"`);
    console.log(`  Valeur sélectionnée: "${selectedValue}"`);
    console.log('');
  });

  // Essayer de trouver le formulaire Ant Design et ses valeurs
  console.log('=== TENTATIVE D\'ACCÈS AUX VALEURS DU FORMULAIRE ANT DESIGN ===\n');
  
  const form = modal.querySelector('form');
  if (form) {
    console.log('✅ Formulaire HTML trouvé');
    
    // Chercher les Form.Item
    const formItems = modal.querySelectorAll('.ant-form-item');
    console.log(`📊 Nombre de Form.Item trouvés: ${formItems.length}\n`);

    formItems.forEach((item, index) => {
      const label = item.querySelector('label')?.textContent?.trim() || 'N/A';
      const input = item.querySelector('input, .ant-select');
      
      let value = 'N/A';
      if (input) {
        if (input.tagName === 'INPUT') {
          value = input.value || '(vide)';
        } else if (input.classList.contains('ant-select')) {
          value = input.querySelector('.ant-select-selection-item')?.textContent || '(non sélectionné)';
        }
      }

      console.log(`Form.Item ${index + 1}:`);
      console.log(`  Label: "${label}"`);
      console.log(`  Valeur: "${value}"`);
      console.log('');
    });
  } else {
    console.warn('⚠️  Formulaire HTML non trouvé');
  }

  // Instructions pour vérifier les données dans React
  console.log('=== INSTRUCTIONS POUR VÉRIFIER LES DONNÉES REACT ===');
  console.log('Pour voir les données React, vous pouvez:');
  console.log('1. Ouvrir React DevTools');
  console.log('2. Sélectionner le composant InscriptionsPage');
  console.log('3. Vérifier l\'état "editingInscription"');
  console.log('4. Vérifier l\'état du formulaire via form.getFieldsValue()');
  console.log('\n💡 Vous pouvez aussi ajouter ce code dans votre composant React:');
  console.log('   console.log("Form values:", form.getFieldsValue());');
  console.log('   console.log("Editing inscription:", editingInscription);');

  console.log('\n=== FIN DE L\'INSPECTION ===');
})();

