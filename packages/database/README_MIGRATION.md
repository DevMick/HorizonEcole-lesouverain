# Application de la migration de paie

## Problème : DATABASE_URL non trouvée

Si vous obtenez l'erreur `Environment variable not found: DATABASE_URL`, c'est parce que Prisma ne trouve pas la variable d'environnement.

## Solution 1 : Script PowerShell (Recommandé)

Exécutez le script depuis le dossier `packages/database` :

```powershell
.\load-env-and-migrate.ps1
```

Ce script :
1. Charge automatiquement les variables depuis `.env` à la racine
2. Applique la migration
3. Génère le client Prisma

## Solution 2 : Chargement manuel des variables

Dans PowerShell, depuis `packages/database` :

```powershell
# Charger les variables depuis .env à la racine
$envFile = "..\..\.env"
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([^#][^=]+)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        $value = $value -replace '^["\']|["\']$', ''
        [Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
}

# Vérifier que DATABASE_URL est chargée
Write-Host "DATABASE_URL: $env:DATABASE_URL"

# Appliquer la migration
pnpm prisma migrate deploy

# Générer le client
pnpm prisma generate
```

## Solution 3 : Créer un fichier .env.local

Créez un fichier `.env` dans `packages/database` avec :

```
DATABASE_URL=postgresql://postgres:DevMick%402003@localhost:5432/school_db
```

Puis exécutez :
```powershell
pnpm prisma migrate deploy
pnpm prisma generate
```

## Solution 4 : Utiliser dotenv-cli

Installez dotenv-cli :
```powershell
pnpm add -D dotenv-cli
```

Puis exécutez :
```powershell
pnpm dotenv -e ../../.env -- pnpm prisma migrate deploy
pnpm dotenv -e ../../.env -- pnpm prisma generate
```

## Vérification

Après l'application, vérifiez que les tables sont créées :

```powershell
pnpm prisma studio
```

Ou connectez-vous à PostgreSQL et listez les tables :
```sql
\dt
```

Vous devriez voir les nouvelles tables :
- teacher_remuneration
- teacher_allowances
- payroll_settings
- monthly_payrolls
- payroll_items
- payroll_payments
- advance_payments
- payroll_correction_requests

