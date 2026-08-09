# Scripts de Test pour le Formulaire d'Inscription

Ce dossier contient des scripts de diagnostic pour tester et déboguer le problème de remplissage du formulaire d'inscription.

## 📋 Scripts Disponibles

### 1. `test-inscription-form.js` - Test Automatique Complet

Ce script effectue un test automatique complet du formulaire d'édition.

**Utilisation:**
1. Ouvrez la page `http://localhost:5173/academic/inscriptions`
2. Ouvrez la console du navigateur (F12 ou Clic droit > Inspecter > Console)
3. Copiez-collez tout le contenu du fichier `test-inscription-form.js` dans la console
4. Appuyez sur Entrée
5. Le script va automatiquement:
   - Trouver le premier bouton d'édition
   - Cliquer dessus
   - Attendre que le modal s'ouvre
   - Vérifier tous les champs du formulaire
   - Afficher un rapport détaillé

**Ce que le script vérifie:**
- ✅ Si le bouton d'édition est trouvé
- ✅ Si le modal s'ouvre correctement
- ✅ Si les champs suivants sont remplis:
  - Prénom de l'élève
  - Nom de l'élève
  - Lieu de naissance
  - Prénom du parent
  - Nom du parent
- ✅ Les valeurs affichées dans chaque champ
- ✅ Les propriétés de chaque input

### 2. `inspect-form.js` - Inspection Manuelle

Ce script permet d'inspecter l'état actuel du formulaire quand le modal est déjà ouvert.

**Utilisation:**
1. Ouvrez la page `http://localhost:5173/academic/inscriptions`
2. Cliquez manuellement sur le bouton "Modifier" d'une inscription
3. Une fois le modal ouvert, ouvrez la console (F12)
4. Copiez-collez tout le contenu du fichier `inspect-form.js` dans la console
5. Appuyez sur Entrée
6. Le script affichera:
   - Tous les inputs trouvés avec leurs valeurs
   - Tous les selects trouvés avec leurs valeurs sélectionnées
   - Les Form.Item Ant Design avec leurs labels et valeurs

## 🔍 Interprétation des Résultats

### ✅ Cas Normal (Tout fonctionne)
```
✅ Prénom de l'élève: "Rahim"
✅ Nom de l'élève: "Ouattara"
✅ Lieu de naissance: "Non spécifié"
✅ Prénom du parent: "Ballo"
✅ Nom du parent: "Ouattara"
```

### ❌ Cas Problématique (Champs vides)
```
❌ Prénom de l'élève: VIDE ou non défini
❌ Nom de l'élève: VIDE ou non défini
```

Si vous voyez des ❌, cela signifie que:
- Les données sont disponibles (vérifiez les logs "=== handleEdit START ===")
- Mais les champs ne sont pas remplis dans le formulaire
- Le problème est probablement dans la logique de `setFieldsValue` ou dans les fonctions `normalize`

## 🐛 Débogage Avancé

### Vérifier les Logs de la Console

Après avoir exécuté le script, cherchez dans la console:

1. **Logs de handleEdit:**
   ```
   === handleEdit START ===
   Inscription data received: {...}
   ```

2. **Logs du useEffect:**
   ```
   useEffect: Setting form values: {...}
   Raw inscription data: {...}
   ```

3. **Logs de vérification:**
   ```
   Form values after setFieldsValue (attempt 1): {...}
   ```

### Comparer les Données

Comparez:
- Les données dans `Inscription data received` (données brutes)
- Les valeurs dans `useEffect: Setting form values` (valeurs préparées)
- Les valeurs dans `Form values after setFieldsValue` (valeurs après définition)
- Les valeurs affichées dans les inputs (ce que vous voyez)

### Points à Vérifier

1. **Noms de propriétés:** Vérifiez si les données utilisent `student_first_name` (snake_case) ou `studentFirstName` (camelCase)
2. **Valeurs vides:** Vérifiez si certaines valeurs sont `null`, `undefined`, ou chaînes vides `""`
3. **Timing:** Vérifiez si les valeurs sont définies avant que le formulaire soit complètement rendu
4. **Normalize:** Vérifiez si les fonctions `normalize` interfèrent avec les valeurs initiales

## 💡 Astuces

### Utiliser React DevTools

1. Installez l'extension React DevTools dans votre navigateur
2. Ouvrez l'onglet "Components"
3. Sélectionnez le composant `InscriptionsPage`
4. Dans le panneau de droite, vérifiez:
   - `editingInscription` - Les données de l'inscription
   - `form` - L'instance du formulaire Ant Design
   - Utilisez `form.getFieldsValue()` pour voir les valeurs actuelles

### Ajouter des Logs Temporaires

Dans `InscriptionsPage.tsx`, vous pouvez ajouter temporairement:

```javascript
// Dans le useEffect, après form.setFieldsValue
console.log('🔍 DEBUG - Form values:', form.getFieldsValue());
console.log('🔍 DEBUG - Editing inscription:', editingInscription);

// Dans le render, pour voir les props des Form.Item
console.log('🔍 DEBUG - Form.Item studentFirstName value:', 
  form.getFieldValue('studentFirstName'));
```

## 📝 Rapport de Bug

Si le problème persiste, collectez ces informations:

1. Résultats du script `test-inscription-form.js`
2. Résultats du script `inspect-form.js`
3. Tous les logs de la console (copiez-collez)
4. Capture d'écran du formulaire vide
5. Version de React et Ant Design utilisée
6. Navigateur et version

## 🔧 Solutions Possibles

Si les champs sont vides malgré les données:

1. **Vérifier les fonctions normalize:** Elles ne doivent pas retourner `undefined` ou `null` pour les valeurs initiales
2. **Vérifier le timing:** Augmenter les délais dans les `setTimeout`
3. **Vérifier les noms de champs:** S'assurer que les noms dans `setFieldsValue` correspondent exactement aux `name` des `Form.Item`
4. **Vérifier preserve:** S'assurer que `preserve={false}` est défini sur le Form pour éviter la persistance de valeurs précédentes

