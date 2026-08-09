# Script pour appliquer la migration SQL directement via PostgreSQL
param(
    [switch]$SkipVerification
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Application directe de la migration SQL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Charger les variables depuis .env
$envFile = "..\..\.env"
if (Test-Path $envFile) {
    Write-Host "[1/4] Chargement des variables d'environnement..." -ForegroundColor Yellow
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
    Write-Host "       Variables chargees" -ForegroundColor Green
} else {
    Write-Host "ERREUR: Fichier .env non trouve" -ForegroundColor Red
    exit 1
}

if (-not $env:DATABASE_URL) {
    Write-Host "ERREUR: DATABASE_URL non definie" -ForegroundColor Red
    exit 1
}

# Parser DATABASE_URL
$dbUrl = $env:DATABASE_URL
if ($dbUrl -match 'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)') {
    $dbUser = $matches[1]
    $dbPass = $matches[2] -replace '%40', '@' -replace '%25', '%'
    $dbHost = $matches[3]
    $dbPort = $matches[4]
    $dbName = $matches[5]
    
    Write-Host "[2/4] Connexion a PostgreSQL..." -ForegroundColor Yellow
    Write-Host "       Host: ${dbHost}:${dbPort}" -ForegroundColor Gray
    Write-Host "       Database: $dbName" -ForegroundColor Gray
    Write-Host "       User: $dbUser" -ForegroundColor Gray
    
    # Vérifier si psql est disponible
    if (Get-Command psql -ErrorAction SilentlyContinue) {
        Write-Host "       psql trouve" -ForegroundColor Green
        
        $sqlFile = ".\prisma\migrations\20250120000000_add_payroll_module\migration.sql"
        if (Test-Path $sqlFile) {
            Write-Host "[3/4] Application du fichier SQL..." -ForegroundColor Yellow
            Write-Host "       Fichier: $sqlFile" -ForegroundColor Gray
            
            $env:PGPASSWORD = $dbPass
            $result = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $sqlFile 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "       Migration appliquee" -ForegroundColor Green
            } else {
                Write-Host "       ERREUR lors de l'application" -ForegroundColor Red
                Write-Host $result
                exit 1
            }
        } else {
            Write-Host "ERREUR: Fichier SQL non trouve: $sqlFile" -ForegroundColor Red
            exit 1
        }
        
        if (-not $SkipVerification) {
            Write-Host "[4/4] Verification des tables..." -ForegroundColor Yellow
            $checkQuery = "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('teacher_remuneration', 'teacher_allowances', 'payroll_settings', 'monthly_payrolls', 'payroll_items', 'payroll_payments', 'advance_payments', 'payroll_correction_requests');"
            $checkResult = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -c $checkQuery 2>&1
            $tableCount = ($checkResult -replace '\s', '')
            
            if ($tableCount -eq '8') {
                Write-Host "       Toutes les tables sont creees (8/8)" -ForegroundColor Green
            } else {
                Write-Host "       Tables trouvees: $tableCount/8" -ForegroundColor Yellow
            }
        }
        
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "Migration appliquee avec succes!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Prochaines etapes:" -ForegroundColor Cyan
        Write-Host "  1. Generer le client Prisma: pnpm prisma generate" -ForegroundColor White
        Write-Host "  2. Redemarrer le serveur API" -ForegroundColor White
        
    } else {
        Write-Host "ERREUR: psql non trouve dans le PATH" -ForegroundColor Red
        Write-Host "        Installez PostgreSQL client tools ou utilisez:" -ForegroundColor Yellow
        Write-Host "        pnpm prisma migrate deploy" -ForegroundColor White
        exit 1
    }
} else {
    Write-Host "ERREUR: Format DATABASE_URL invalide" -ForegroundColor Red
    exit 1
}

