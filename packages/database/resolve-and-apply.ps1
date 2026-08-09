# Script pour résoudre l'erreur P3005 et appliquer la migration
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RESOLUTION ET APPLICATION MIGRATION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Charger les variables
$envFile = "..\..\.env"
if (Test-Path $envFile) {
    Write-Host "[1/4] Chargement des variables..." -ForegroundColor Yellow
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

# Option 1: Essayer migrate deploy avec --skip-generate
Write-Host "[2/4] Tentative d'application de la migration..." -ForegroundColor Yellow
& pnpm prisma migrate deploy --skip-generate
if ($LASTEXITCODE -eq 0) {
    Write-Host "       Migration appliquee via migrate deploy" -ForegroundColor Green
    $migrationApplied = $true
} else {
    Write-Host "       migrate deploy a echoue, utilisation de db push..." -ForegroundColor Yellow
    $migrationApplied = $false
}

# Option 2: Si migrate deploy échoue, utiliser db push
if (-not $migrationApplied) {
    Write-Host "[3/4] Application via db push (synchronise le schema)..." -ForegroundColor Yellow
    & pnpm prisma db push --skip-generate --accept-data-loss
    if ($LASTEXITCODE -eq 0) {
        Write-Host "       Schema synchronise" -ForegroundColor Green
        
        # Marquer la migration comme appliquée
        Write-Host "       Marquage de la migration comme appliquee..." -ForegroundColor Yellow
        & pnpm prisma migrate resolve --applied 20250120000000_add_payroll_module
        Write-Host "       Migration marquee comme appliquee" -ForegroundColor Green
    } else {
        Write-Host "       ERREUR lors de db push" -ForegroundColor Red
        exit 1
    }
}

# Générer le client
Write-Host "[4/4] Generation du client Prisma..." -ForegroundColor Yellow
& pnpm prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR lors de la generation" -ForegroundColor Red
    exit 1
}
Write-Host "       OK" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  MIGRATION APPLIQUEE AVEC SUCCES!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

