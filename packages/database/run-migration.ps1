# Charger les variables d'environnement
$envFile = "..\..\.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            $value = $value -replace '^["\']|["\']$', ''
            Set-Item -Path "env:$name" -Value $value
        }
    }
}

# Exécuter la migration
& pnpm prisma migrate deploy

# Générer le client
& pnpm prisma generate

