# Script pour exécuter la migration SQL directement
# Utilise System.Data pour se connecter à PostgreSQL

Add-Type -AssemblyName System.Data

# Charger les variables depuis .env
$envFile = "..\..\.env"
if (Test-Path $envFile) {
    Write-Host "Chargement des variables d'environnement..." -ForegroundColor Cyan
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
    
    Write-Host "Connexion a PostgreSQL..." -ForegroundColor Cyan
    Write-Host "  Host: ${dbHost}:${dbPort}" -ForegroundColor Gray
    Write-Host "  Database: $dbName" -ForegroundColor Gray
    Write-Host "  User: $dbUser" -ForegroundColor Gray
    
    # Lire le fichier SQL
    $sqlFile = ".\prisma\migrations\20250120000000_add_payroll_module\migration.sql"
    if (-not (Test-Path $sqlFile)) {
        Write-Host "ERREUR: Fichier SQL non trouve: $sqlFile" -ForegroundColor Red
        exit 1
    }
    
    $sqlContent = Get-Content $sqlFile -Raw
    
    Write-Host "`nApplication de la migration SQL..." -ForegroundColor Yellow
    
    try {
        # Utiliser Npgsql si disponible, sinon utiliser psql
        $connectionString = "Host=$dbHost;Port=$dbPort;Database=$dbName;Username=$dbUser;Password=$dbPass"
        
        # Essayer d'utiliser psql d'abord
        if (Get-Command psql -ErrorAction SilentlyContinue) {
            Write-Host "Utilisation de psql..." -ForegroundColor Gray
            $env:PGPASSWORD = $dbPass
            $sqlContent | psql -h $dbHost -p $dbPort -U $dbUser -d $dbName
            if ($LASTEXITCODE -eq 0) {
                Write-Host "`nMigration appliquee avec succes!" -ForegroundColor Green
            } else {
                Write-Host "`nErreur lors de l'application" -ForegroundColor Red
                exit 1
            }
        } else {
            Write-Host "psql non disponible. Utilisation de Prisma..." -ForegroundColor Yellow
            Write-Host "Executez manuellement: pnpm prisma migrate deploy" -ForegroundColor Yellow
            exit 1
        }
    } catch {
        Write-Host "ERREUR: $_" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "ERREUR: Format DATABASE_URL invalide" -ForegroundColor Red
    exit 1
}

