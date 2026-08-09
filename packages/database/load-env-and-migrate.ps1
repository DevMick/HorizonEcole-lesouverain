# Script pour charger les variables d'environnement et appliquer la migration
Write-Host "🔧 Chargement des variables d'environnement..." -ForegroundColor Cyan

# Chemin vers le fichier .env à la racine du projet
$rootPath = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$envFile = Join-Path $rootPath ".env"

if (Test-Path $envFile) {
    Write-Host "✅ Fichier .env trouvé: $envFile" -ForegroundColor Green
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            # Nettoyer les valeurs (enlever les guillemets si présents)
            $value = $value -replace '^["\']|["\']$', ''
            [Environment]::SetEnvironmentVariable($name, $value, 'Process')
            Write-Host "   ✓ $name" -ForegroundColor Gray
        }
    }
    Write-Host "✅ Variables d'environnement chargées" -ForegroundColor Green
} else {
    Write-Host "❌ Fichier .env non trouvé à: $envFile" -ForegroundColor Red
    Write-Host "   Veuillez créer un fichier .env à la racine du projet avec DATABASE_URL" -ForegroundColor Yellow
    exit 1
}

# Vérifier que DATABASE_URL est définie
if (-not $env:DATABASE_URL) {
    Write-Host "❌ DATABASE_URL n'est pas définie" -ForegroundColor Red
    exit 1
}

Write-Host "`n🚀 Application de la migration..." -ForegroundColor Cyan
& pnpm prisma migrate deploy

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Migration appliquée avec succès !" -ForegroundColor Green
    Write-Host "`n📦 Génération du client Prisma..." -ForegroundColor Cyan
    & pnpm prisma generate
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Client Prisma généré avec succès !" -ForegroundColor Green
    }
} else {
    Write-Host "`n❌ Erreur lors de l'application de la migration" -ForegroundColor Red
    exit 1
}

