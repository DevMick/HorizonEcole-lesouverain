# Application directe de la migration SQL via connexion PostgreSQL native
# Utilise System.Data.Odbc ou Npgsql si disponible

# Charger les variables
$envFile = "..\..\.env"
if (Test-Path $envFile) {
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
    
    Write-Host "Connexion: ${dbHost}:${dbPort}/${dbName}" -ForegroundColor Cyan
    
    # Lire le SQL
    $sqlFile = ".\prisma\migrations\20250120000000_add_payroll_module\migration.sql"
    $sqlContent = Get-Content $sqlFile -Raw
    
    Write-Host "Application du SQL..." -ForegroundColor Yellow
    
    # Utiliser psql si disponible
    if (Get-Command psql -ErrorAction SilentlyContinue) {
        $env:PGPASSWORD = $dbPass
        $sqlContent | psql -h $dbHost -p $dbPort -U $dbUser -d $dbName
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Migration appliquee!" -ForegroundColor Green
        }
    } else {
        Write-Host "psql non disponible. Utilisez: pnpm prisma migrate deploy" -ForegroundColor Yellow
    }
}

