# Guide de Test Manuel du Formulaire d'Inscription

## 🚀 Démarrage Rapide

### Étape 1: Préparer l'environnement

1. **Assurez-vous que l'application est en cours d'exécution:**
   ```bash
   # Dans le terminal, vous devriez voir le serveur démarré
   # Frontend: http://localhost:5173
   # Backend: http://localhost:4000
   ```

2. **Ouvrez votre navigateur** et allez sur: `http://localhost:5173`

### Étape 2: Se connecter

1. Connectez-vous avec vos identifiants administrateur
2. Naviguez vers la page des inscriptions: `http://localhost:5173/academic/inscriptions`

### Étape 3: Exécuter le script de test

1. **Ouvrez la console du navigateur:**
   - Appuyez sur `F12` ou
   - Clic droit > Inspecter > Onglet "Console"

2. **Copiez-collez le script de test:**
   - Ouvrez le fichier `apps/web/test-inscription-form.js`
   - Copiez tout le contenu (Ctrl+A puis Ctrl+C)
   - Collez dans la console (Ctrl+V)
   - Appuyez sur Entrée

3. **Observez les résultats:**
   - Le script va automatiquement cliquer sur le bouton d'édition
   - Il vérifiera tous les champs du formulaire
   - Il affichera un rapport détaillé dans la console

## 📊 Interprétation des Résultats

### ✅ Cas de Succès

Si vous voyez ceci, tout fonctionne correctement:

```
✅ Prénom de l'élève: "Rahim"
✅ Nom de l'élève: "Ouattara"
✅ Lieu de naissance: "Non spécifié"
✅ Prénom du parent: "Ballo"
✅ Nom du parent: "Ouattara"
```

### ❌ Cas de Problème

Si vous voyez ceci, il y a un problème:

```
❌ Prénom de l'élève: VIDE ou non défini
❌ Nom de l'élève: VIDE ou non défini
❌ Lieu de naissance: VIDE ou non défini
❌ Prénom du parent: VIDE ou non défini
❌ Nom du parent: VIDE ou non défini
```

## 🔍 Analyse Détaillée

### Vérifier les Logs de la Console

Après l'exécution du script, cherchez ces logs dans la console:

#### 1. Logs de `handleEdit`
```
=== handleEdit START ===
Inscription data received: {
  "student_first_name": "Rahim",
  "student_last_name": "Ouattara",
  ...
}
```

**À vérifier:**
- Les données sont-elles présentes?
- Utilisent-elles `snake_case` (student_first_name) ou `camelCase` (studentFirstName)?

#### 2. Logs du `useEffect`
```
useEffect: Setting form values: {
  "studentFirstName": "Rahim",
  "studentLastName": "Ouattara",
  ...
}
Raw inscription data: {
  studentFirstName: "Rahim",
  student_first_name: "Rahim",
  ...
}
```

**À vérifier:**
- Les valeurs sont-elles correctement extraites?
- Les deux formats (camelCase et snake_case) sont-ils présents?

#### 3. Logs de Vérification
```
Form values after setFieldsValue (attempt 1): {
  "studentFirstName": "Rahim",
  ...
}
```

**À vérifier:**
- Les valeurs sont-elles définies dans le formulaire?
- Y a-t-il des tentatives de retry?

#### 4. Logs de Retry
```
Missing studentFirstName, will retry: Rahim
Setting studentFirstName to: Rahim
```

**À vérifier:**
- Le retry fonctionne-t-il?
- Les valeurs sont-elles définies après le retry?

## 🐛 Diagnostic des Problèmes Courants

### Problème 1: Les données sont présentes mais les champs sont vides

**Symptômes:**
- Les logs montrent que les données sont reçues
- Les logs montrent que `setFieldsValue` est appelé
- Mais les inputs sont vides

**Causes possibles:**
1. **Fonction `normalize` qui interfère:**
   - Vérifiez si `normalize` retourne `undefined` ou `null`
   - Solution: Améliorer la fonction `normalize` pour gérer les valeurs initiales

2. **Timing:**
   - Le formulaire n'est pas encore rendu quand on définit les valeurs
   - Solution: Augmenter les délais dans les `setTimeout`

3. **Noms de champs incorrects:**
   - Les noms dans `setFieldsValue` ne correspondent pas aux `name` des `Form.Item`
   - Solution: Vérifier que les noms correspondent exactement

### Problème 2: Certains champs se remplissent, d'autres non

**Symptômes:**
- Le prénom de l'élève se remplit mais pas le nom
- Ou vice versa

**Causes possibles:**
1. **Propriétés manquantes dans les données:**
   - Vérifiez les logs "Raw inscription data"
   - Certaines propriétés peuvent être `undefined` ou `null`

2. **Problème avec la fonction `getValue`:**
   - La fonction ne trouve pas les valeurs dans les deux formats
   - Solution: Vérifier la logique de fallback

### Problème 3: Les valeurs disparaissent après avoir été définies

**Symptômes:**
- Les valeurs sont définies brièvement puis disparaissent
- Les logs montrent que les valeurs sont définies mais les inputs sont vides

**Causes possibles:**
1. **Re-render du composant:**
   - Le composant se re-rend et réinitialise le formulaire
   - Solution: Vérifier les dépendances du `useEffect`

2. **Conflit avec `preserve={false}`:**
   - Le formulaire est réinitialisé à chaque render
   - Solution: Vérifier la configuration du `Form`

## 📝 Checklist de Débogage

Utilisez cette checklist pour identifier le problème:

- [ ] Les données sont reçues dans `handleEdit` (vérifier les logs)
- [ ] Les données sont transformées correctement dans `useEffect` (vérifier "Setting form values")
- [ ] `setFieldsValue` est appelé avec les bonnes valeurs (vérifier les logs)
- [ ] Les valeurs sont définies dans le formulaire (vérifier "Form values after setFieldsValue")
- [ ] Les inputs sont présents dans le DOM (vérifier avec `inspect-form.js`)
- [ ] Les noms des champs correspondent (vérifier `name` dans `Form.Item` vs clés dans `setFieldsValue`)
- [ ] Les fonctions `normalize` ne retournent pas `undefined` (vérifier le code)
- [ ] Le timing est correct (vérifier les délais dans les `setTimeout`)

## 🛠️ Scripts Utiles

### Script 1: Vérifier l'état actuel du formulaire
```javascript
// Exécutez ceci quand le modal est ouvert
const modal = document.querySelector('.ant-modal');
const inputs = modal.querySelectorAll('input');
inputs.forEach(input => {
  if (input.placeholder) {
    console.log(`${input.placeholder}: "${input.value || '(vide)'}"`);
  }
});
```

### Script 2: Forcer une valeur dans un champ
```javascript
// Remplacez "studentFirstName" par le nom du champ
const input = document.querySelector('input[placeholder="Prénom"]');
input.value = 'TEST';
input.dispatchEvent(new Event('input', { bubbles: true }));
input.dispatchEvent(new Event('change', { bubbles: true }));
console.log('Valeur définie:', input.value);
```

### Script 3: Vérifier les données React (nécessite React DevTools)
1. Installez l'extension React DevTools
2. Ouvrez l'onglet "Components"
3. Sélectionnez `InscriptionsPage`
4. Dans le panneau de droite, vérifiez:
   - `editingInscription` - Les données brutes
   - Utilisez `form.getFieldsValue()` pour voir les valeurs du formulaire

## 📞 Rapport de Bug

Si le problème persiste, collectez ces informations:

1. **Résultats du script de test:**
   - Copiez tous les logs de la console
   - Prenez une capture d'écran du formulaire vide

2. **Informations sur l'environnement:**
   - Navigateur et version
   - Version de React
   - Version d'Ant Design

3. **Données de test:**
   - Les données de l'inscription que vous essayez d'éditer
   - Les logs complets de la console

4. **Comportement attendu vs réel:**
   - Ce qui devrait se passer
   - Ce qui se passe réellement

## ✅ Solutions Implémentées

Les modifications suivantes ont été apportées au code:

1. ✅ Amélioration de l'extraction des valeurs avec fonction `getValue`
2. ✅ Amélioration des fonctions `normalize` pour gérer `undefined`/`null`
3. ✅ Ajout d'une logique de retry avec jusqu'à 3 tentatives
4. ✅ Ajout de logs détaillés pour le débogage
5. ✅ Ajustement des délais pour s'assurer que le formulaire est rendu

Si le problème persiste après ces modifications, utilisez les scripts de test pour identifier précisément où le problème se produit.

