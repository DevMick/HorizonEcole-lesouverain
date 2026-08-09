# Stratégie d'Harmonisation des Couleurs - École Le Souverain de Larabia

## 🎨 Palette de Couleurs

### Couleurs Principales
- **Vert Principal** : `#24AE6A` - Couleur phare du logo
- **Orange Secondaire** : `#E96702` - Couleur phare du logo

## 📐 Stratégie d'Utilisation

### 1. Vert (#24AE6A) - Actions Principales
Utiliser pour :
- ✅ Boutons primaires (connexion, sauvegarder, valider)
- ✅ Liens importants et navigation principale
- ✅ Titres et en-têtes de sections
- ✅ Icônes principales
- ✅ États de succès
- ✅ Bordures et accents principaux

### 2. Orange (#E96702) - Actions Secondaires & Accents
Utiliser pour :
- 🟠 Boutons secondaires (annuler, exporter, imprimer)
- 🟠 Badges d'alerte et d'information
- 🟠 Éléments de mise en évidence
- 🟠 Hover states alternatifs
- 🟠 Icônes d'alerte/attention
- 🟠 Accents dans les cartes et widgets

## 🎯 Règles d'Harmonisation

### Gradients Harmonieux
- **Gradient vert-orange** : `linear-gradient(135deg, #24AE6A 0%, #E96702 100%)`
  - Utiliser pour les éléments décoratifs
  - Accents subtils sous les titres
  - Séparateurs visuels

### Contraste et Lisibilité
- Toujours vérifier le contraste pour l'accessibilité
- Utiliser le vert sur fond clair
- Utiliser l'orange avec parcimonie pour ne pas surcharger

### Hiérarchie Visuelle
1. **Vert** = Actions principales, éléments essentiels
2. **Orange** = Actions secondaires, éléments d'attention
3. **Gris** = Texte et éléments neutres

## 💡 Exemples d'Utilisation

### Boutons
```tsx
// Bouton primaire (vert)
<Button className="modern-button-primary">Sauvegarder</Button>

// Bouton secondaire (orange)
<Button className="modern-button-secondary">Exporter</Button>

// Bouton outline orange
<Button className="modern-button-secondary-outline">Annuler</Button>
```

### Badges
```tsx
// Badge avec accent orange
<Tag className="badge-accent">Nouveau</Tag>
```

### Accents
```tsx
// Élément avec accent orange
<div className="accent-orange">Texte important</div>

// Fond avec accent orange
<div className="accent-orange-bg">Contenu</div>
```

## 🎨 Classes CSS Disponibles

### Boutons
- `.modern-button-primary` - Bouton principal vert
- `.modern-button-secondary` - Bouton secondaire orange
- `.modern-button-secondary-outline` - Bouton outline orange

### Badges
- `.badge-accent` - Badge avec couleur orange

### Utilitaires
- `.gradient-primary-secondary` - Gradient vert-orange
- `.accent-orange` - Texte orange
- `.accent-orange-bg` - Fond avec accent orange

## 📱 Application dans les Pages

### Page de Login
- ✅ Fond avec cercles décoratifs verts et oranges
- ✅ Pattern de points avec les deux couleurs
- ✅ Accent gradient sous le sous-titre
- ✅ Bouton de connexion vert

### Pages Internes
- ✅ Navigation principale en vert
- ✅ Boutons d'action primaires en vert
- ✅ Boutons d'action secondaires en orange
- ✅ Badges et tags avec accent orange
- ✅ Hover states alternatifs

## 🔄 Évolution Future

Pour ajouter plus d'harmonie :
1. Utiliser des gradients subtils entre les deux couleurs
2. Créer des variantes de cartes avec accents orange
3. Ajouter des animations de transition entre les couleurs
4. Utiliser l'orange pour les notifications et alertes importantes

