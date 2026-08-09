# Script pour appliquer la migration contrat/heures et régénérer le client Prisma

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  APPLICATION MIGRATION CONTRAT/HEURES" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Charger les variables d'environnement
Write-Host "[1/3] Chargement des variables d'environnement..." -ForegroundColor Yellow
$envFile = "..\..\.env"
if (-not (Test-Path $envFile)) {
    Write-Host "ERREUR: Fichier .env non trouvé à $envFile" -ForegroundColor Red
    exit 1
}
Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith('#')) {
        $parts = $line.Split('=', 2)
        if ($parts.Length -eq 2) {
            $name = $parts[0].Trim()
            $value = $parts[1].Trim()
            # Supprimer les guillemets si présents
            $value = $value -replace '^"|"$', ''
            [Environment]::SetEnvironmentVariable($name, $value, 'Process')
        }
    }
}
Write-Host "       OK" -ForegroundColor Green
Write-Host ""

# 2. Appliquer la migration
Write-Host "[2/3] Application de la migration..." -ForegroundColor Yellow
Write-Host "       (via script TypeScript)"
Write-Host "       Utilisation de pnpm..."
try {
    & pnpm apply-contract-hours-migration
    if ($LASTEXITCODE -eq 0) {
        Write-Host "       Migration appliquée avec succès" -ForegroundColor Green
    } else {
        Write-Host "       ERREUR lors de l'application" -ForegroundColor Red
        throw "Erreur lors de l'application de la migration"
    }
} catch {
    Write-Host "ERREUR" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
Write-Host ""

# 3. Régénérer le client Prisma
Write-Host "[3/3] Régénération du client Prisma..." -ForegroundColor Yellow
Write-Host "       (via prisma generate)"
try {
    & pnpm generate
    if ($LASTEXITCODE -eq 0) {
        Write-Host "       Client Prisma régénéré avec succès" -ForegroundColor Green
    } else {
        Write-Host "       ERREUR lors de la régénération" -ForegroundColor Red
        throw "Erreur lors de la régénération du client Prisma"
    }
} catch {
    Write-Host "ERREUR" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "  TERMINE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Redémarrez le serveur API pour appliquer les changements" -ForegroundColor Yellow

