# Script de vérification de la migration de paie
Write-Host "🔍 Vérification du statut de la migration de paie..." -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor DarkGray

# Charger les variables d'environnement
$envFile = "..\..\.env"
if (Test-Path $envFile) {
    Write-Host "`n1️⃣  Chargement des variables d'environnement..." -ForegroundColor Cyan
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            $value = $value -replace '^["\']|["\']$', ''
            Set-Item -Path "env:$name" -Value $value
        }
    }
    Write-Host "✅ Variables chargées" -ForegroundColor Green
} else {
    Write-Host "❌ Fichier .env non trouvé" -ForegroundColor Red
    exit 1
}

if (-not $env:DATABASE_URL) {
    Write-Host "❌ DATABASE_URL non définie" -ForegroundColor Red
    exit 1
}

# Extraire les informations de connexion
$dbUrl = $env:DATABASE_URL
Write-Host "`n2️⃣  Informations de connexion..." -ForegroundColor Cyan
Write-Host "   Database URL: $($dbUrl.Substring(0, [Math]::Min(50, $dbUrl.Length)))..." -ForegroundColor Gray

# Vérifier via Prisma si disponible
Write-Host "`n3️⃣  Vérification via Prisma..." -ForegroundColor Cyan
$prismaFound = $false

# Chercher Prisma dans node_modules
$prismaPaths = @(
    ".\node_modules\.bin\prisma.cmd",
    "..\..\node_modules\.bin\prisma.cmd"
)

foreach ($path in $prismaPaths) {
    if (Test-Path $path) {
        $prismaFound = $true
        Write-Host "   ✅ Prisma trouvé: $path" -ForegroundColor Green
        try {
            Write-Host "   Exécution de: prisma migrate status" -ForegroundColor Yellow
            $status = & $path migrate status 2>&1
            Write-Host $status
            break
        } catch {
            Write-Host "   ⚠️  Erreur lors de l'exécution: $_" -ForegroundColor Yellow
        }
    }
}

if (-not $prismaFound) {
    Write-Host "   ⚠️  Prisma CLI non trouvé dans node_modules" -ForegroundColor Yellow
    Write-Host "   💡 Exécutez: pnpm install" -ForegroundColor Yellow
}

# Vérifier via psql si disponible
Write-Host "`n4️⃣  Vérification via PostgreSQL (psql)..." -ForegroundColor Cyan
if (Get-Command psql -ErrorAction SilentlyContinue) {
    Write-Host "   ✅ psql trouvé" -ForegroundColor Green
    
    # Extraire les informations de connexion
    if ($dbUrl -match 'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)') {
        $user = $matches[1]
        $pass = $matches[2]
        $host = $matches[3]
        $port = $matches[4]
        $db = $matches[5]
        
        Write-Host "   Connexion a: ${host}:${port}/${db}" -ForegroundColor Gray
        
        $query = @"
SELECT 
    COUNT(*) as nombre_tables,
    STRING_AGG(table_name, ', ' ORDER BY table_name) as tables_trouvees
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'teacher_remuneration',
    'teacher_allowances',
    'payroll_settings',
    'monthly_payrolls',
    'payroll_items',
    'payroll_payments',
    'advance_payments',
    'payroll_correction_requests'
);
"@
        
        try {
            $env:PGPASSWORD = $pass
            $result = psql -h $host -p $port -U $user -d $db -t -c $query 2>&1
            Write-Host "   Résultat:" -ForegroundColor Yellow
            Write-Host $result
            
            if ($result -match '(\d+)\s*\|\s*(.+)') {
                $count = [int]$matches[1]
                $tables = $matches[2]
                
                if ($count -eq 8) {
                    Write-Host "`n   ✅ TOUTES les tables de paie sont créées (8/8)" -ForegroundColor Green
                    Write-Host "   Tables: $tables" -ForegroundColor Gray
                } elseif ($count -gt 0) {
                    Write-Host "`n   ⚠️  Seulement $count/8 tables trouvées" -ForegroundColor Yellow
                    Write-Host "   Tables trouvées: $tables" -ForegroundColor Gray
                    Write-Host "   💡 La migration n'est pas complète" -ForegroundColor Yellow
                } else {
                    Write-Host "`n   ❌ AUCUNE table de paie trouvée" -ForegroundColor Red
                    Write-Host "   💡 La migration n'a pas été appliquée" -ForegroundColor Yellow
                }
            }
        } catch {
            Write-Host "   ⚠️  Erreur de connexion: $_" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ⚠️  Impossible de parser DATABASE_URL" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠️  psql non trouvé dans le PATH" -ForegroundColor Yellow
    Write-Host "   💡 Installez PostgreSQL client tools" -ForegroundColor Yellow
}

Write-Host "`n" + "=" * 80 -ForegroundColor DarkGray
Write-Host "📝 Résumé:" -ForegroundColor Cyan
Write-Host "   - Migration SQL: ✅ Créée" -ForegroundColor White
Write-Host "   - Statut application: Vérifiez ci-dessus" -ForegroundColor White
Write-Host "`n💡 Si la migration n'est pas appliquée, exécutez:" -ForegroundColor Yellow
Write-Host "   pnpm prisma migrate deploy" -ForegroundColor White
Write-Host '   pnpm prisma generate' -ForegroundColor White

