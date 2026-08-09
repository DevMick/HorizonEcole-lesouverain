# Script pour vérifier et corriger la structure de payroll_settings
# Usage: .\VERIFIER-ET-CORRIGER.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  VERIFICATION ET CORRECTION" -ForegroundColor Cyan
Write-Host "  payroll_settings" -ForegroundColor Cyan
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
Write-Host "[2/2] Vérification et correction..." -ForegroundColor Yellow
Write-Host "       (via script TypeScript)" -ForegroundColor Gray
Write-Host "       Utilisation de pnpm..." -ForegroundColor Gray
try {
    & pnpm verify-payroll-settings
    if ($LASTEXITCODE -eq 0) {
        Write-Host "       Vérification terminée avec succès" -ForegroundColor Green
    } else {
        Write-Host "       ERREUR lors de la vérification" -ForegroundColor Red
        throw "Erreur lors de la vérification"
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
Write-Host "💡 Si des corrections ont été apportées, redémarrez le serveur API" -ForegroundColor Yellow
Write-Host ""

