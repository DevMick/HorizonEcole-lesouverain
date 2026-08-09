# Script final pour appliquer la migration de paie
# Ce script applique le SQL directement et marque la migration comme résolue

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  APPLICATION MIGRATION DE PAIE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Charger les variables
$envFile = "..\..\.env"
if (Test-Path $envFile) {
    Write-Host "[1/3] Chargement des variables..." -ForegroundColor Yellow
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
    Write-Host "       OK" -ForegroundColor Green
} else {
    Write-Host "ERREUR: .env non trouve" -ForegroundColor Red
    exit 1
}

if (-not $env:DATABASE_URL) {
    Write-Host "ERREUR: DATABASE_URL manquante" -ForegroundColor Red
    exit 1
}

# Appliquer la migration via le script TypeScript
Write-Host "[2/3] Application de la migration SQL..." -ForegroundColor Yellow
Write-Host "       (via script TypeScript)" -ForegroundColor Gray

# Essayer avec pnpm
$pnpmPath = Get-Command pnpm -ErrorAction SilentlyContinue
if ($pnpmPath) {
    Write-Host "       Utilisation de pnpm..." -ForegroundColor Gray
    & pnpm --filter @school/database apply-payroll-migration
    if ($LASTEXITCODE -eq 0) {
        Write-Host "       Migration appliquee" -ForegroundColor Green
    } else {
        Write-Host "       ERREUR lors de l'application" -ForegroundColor Red
        exit 1
    }
} else {
    # Essayer avec npx
    $npxPath = Get-Command npx -ErrorAction SilentlyContinue
    if ($npxPath) {
        Write-Host "       Utilisation de npx..." -ForegroundColor Gray
        & npx tsx src/scripts/apply-payroll-migration.ts
        if ($LASTEXITCODE -eq 0) {
            Write-Host "       Migration appliquee" -ForegroundColor Green
        } else {
            Write-Host "       ERREUR lors de l'application" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "ERREUR: pnpm ou npx non trouve" -ForegroundColor Red
        Write-Host "       Veuillez installer pnpm ou npx" -ForegroundColor Yellow
        exit 1
    }
}

# Générer le client Prisma
Write-Host "[3/3] Generation du client Prisma..." -ForegroundColor Yellow
if ($pnpmPath) {
    & pnpm --filter @school/database generate
} else {
    & npx prisma generate
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "       ERREUR lors de la generation" -ForegroundColor Red
    exit 1
}
Write-Host "       OK" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  MIGRATION APPLIQUEE AVEC SUCCES!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Prochaines etapes:" -ForegroundColor Cyan
Write-Host "  1. Redemarrer le serveur API" -ForegroundColor White
Write-Host "  2. Verifier les tables dans Prisma Studio: pnpm --filter @school/database studio" -ForegroundColor White
Write-Host ""

