# Script pour appliquer la migration seniority_bareme
# Usage: .\APPLIQUER-SENIORITY-BAREME.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  APPLICATION DE LA MIGRATION" -ForegroundColor Cyan
Write-Host "  seniority_bareme" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Charger les variables d'environnement depuis la racine du projet
$envPath = Join-Path $PSScriptRoot "..\..\.env"
if (Test-Path $envPath) {
    Write-Host "[1/2] Chargement des variables d'environnement..." -ForegroundColor Yellow
    Get-Content $envPath | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
    Write-Host "       OK" -ForegroundColor Green
} else {
    Write-Host "[1/2] Fichier .env non trouvé, utilisation des variables système..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[2/2] Application de la migration SQL..." -ForegroundColor Yellow
Write-Host "       (via script TypeScript)" -ForegroundColor Gray
Write-Host "       Utilisation de pnpm..." -ForegroundColor Gray
try {
    & pnpm apply-seniority-bareme-migration
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
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TERMINE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 N'oubliez pas de régénérer le client Prisma:" -ForegroundColor Yellow
Write-Host "   pnpm generate" -ForegroundColor Cyan
Write-Host ""

