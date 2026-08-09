Write-Host "Verification du statut de la migration de paie..." -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor DarkGray

$envFile = "..\..\.env"
if (Test-Path $envFile) {
    Write-Host "`n1. Chargement des variables d'environnement..." -ForegroundColor Cyan
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
    Write-Host "   Variables chargees" -ForegroundColor Green
} else {
    Write-Host "   Fichier .env non trouve" -ForegroundColor Red
    exit 1
}

if (-not $env:DATABASE_URL) {
    Write-Host "   DATABASE_URL non definie" -ForegroundColor Red
    exit 1
}

Write-Host "`n2. Verification via Prisma..." -ForegroundColor Cyan
$prismaPaths = @(
    ".\node_modules\.bin\prisma.cmd",
    "..\..\node_modules\.bin\prisma.cmd"
)

$prismaFound = $false
foreach ($path in $prismaPaths) {
    if (Test-Path $path) {
        $prismaFound = $true
        Write-Host "   Prisma trouve: $path" -ForegroundColor Green
        Write-Host "   Execution de: prisma migrate status" -ForegroundColor Yellow
        & $path migrate status
        break
    }
}

if (-not $prismaFound) {
    Write-Host "   Prisma CLI non trouve dans node_modules" -ForegroundColor Yellow
    Write-Host "   Executez: pnpm install" -ForegroundColor Yellow
}

Write-Host "`n================================================" -ForegroundColor DarkGray
Write-Host "Resume:" -ForegroundColor Cyan
Write-Host "   - Migration SQL: Creee" -ForegroundColor White
Write-Host "   - Statut application: Verifiez ci-dessus" -ForegroundColor White
Write-Host "`nSi la migration n'est pas appliquee, executez:" -ForegroundColor Yellow
Write-Host "   pnpm prisma migrate deploy" -ForegroundColor White
Write-Host "   pnpm prisma generate" -ForegroundColor White

