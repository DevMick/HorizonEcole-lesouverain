# 🔧 Instructions : Charger les Variables d'Environnement

## Problème

L'erreur `Environment variable not found: DATABASE_URL` indique que Prisma ne trouve pas la variable d'environnement.

## ✅ Solution Rapide

Dans votre terminal PowerShell, depuis `packages/database`, exécutez :

```powershell
# Méthode 1 : Utiliser le script
. .\load-env.ps1

# Puis exécutez votre commande
pnpm prisma migrate status
```

## ✅ Solution Manuelle

Si le script ne fonctionne pas, chargez manuellement les variables :

```powershell
# Depuis packages/database
$envFile = "..\..\.env"
Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith('#')) {
        $parts = $line.Split('=', 2)
        if ($parts.Length -eq 2) {
            $name = $parts[0].Trim()
            $value = $parts[1].Trim()
            $value = $value -replace '^["'']|["'']$', ''
            Set-Item -Path "env:$name" -Value $value
        }
    }
}

# Vérifier que DATABASE_URL est chargée
Write-Host "DATABASE_URL: $env:DATABASE_URL"

# Maintenant vous pouvez exécuter
pnpm prisma migrate status
```

## 🚀 Appliquer la Migration

Une fois les variables chargées :

```powershell
# Vérifier le statut
pnpm prisma migrate status

# Si la migration n'est pas appliquée, l'appliquer
pnpm prisma migrate deploy

# Générer le client Prisma
pnpm prisma generate
```

## 📝 Note

Les variables d'environnement chargées avec `Set-Item -Path "env:$name"` sont valides uniquement pour la session PowerShell actuelle. Si vous fermez le terminal, vous devrez les recharger.

## ✅ Vérification

Après avoir chargé les variables, vérifiez :

```powershell
$env:DATABASE_URL
```

Vous devriez voir : `postgresql://postgres:DevMick%402003@localhost:5432/school_db`

