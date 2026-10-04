<#
.SYNOPSIS
    Starts סדר, doing whatever first-run setup is still missing.

.DESCRIPTION
    Safe to run repeatedly. Each step is skipped when it has already been done,
    so the second run goes straight to the dev server.

      1. checks Node
      2. writes .env if absent
      3. npm install        (only when node_modules is missing)
      4. prisma generate + migrate + seed   (only when prisma/dev.db is missing)
      5. starts the server and opens the browser

.PARAMETER Port
    Port to serve on. Default 3000.

.PARAMETER Prod
    Build once and serve the production build instead of the dev server.

.PARAMETER Fresh
    Delete the database first and re-seed. Destroys all local task data.

.PARAMETER NoOpen
    Do not open a browser window.

.EXAMPLE
    .\run.ps1
.EXAMPLE
    .\run.ps1 -Port 4000 -Prod
.EXAMPLE
    .\run.ps1 -Fresh
#>

[CmdletBinding()]
param(
    [int]$Port = 3000,
    [switch]$Prod,
    [switch]$Fresh,
    [switch]$NoOpen
)

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

function Write-Step { param([string]$Text) Write-Host "==> $Text" -ForegroundColor Cyan }
function Write-Skip { param([string]$Text) Write-Host "    $Text" -ForegroundColor DarkGray }
function Write-Fail { param([string]$Text) Write-Host "!!  $Text" -ForegroundColor Red }

# --- Node -------------------------------------------------------------------

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Fail 'Node.js was not found on PATH. Install Node 22.12 or newer from https://nodejs.org and run this again.'
    exit 1
}

$nodeVersion = [version]((& node --version).TrimStart('v'))
if ($nodeVersion -lt [version]'22.12.0') {
    Write-Fail "Node $nodeVersion is too old. This project needs Node 22.12 or newer."
    exit 1
}

# --- Port -------------------------------------------------------------------

# Next silently moves to the next free port if this one is taken, which would
# leave the browser pointing at nothing. Fail loudly instead.
$inUse = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($inUse) {
    $owner = (Get-Process -Id $inUse[0].OwningProcess -ErrorAction SilentlyContinue).ProcessName
    Write-Fail "Port $Port is already in use by '$owner' (PID $($inUse[0].OwningProcess))."
    Write-Host  "    Stop it, or start on another port:  .\run.ps1 -Port 3001" -ForegroundColor DarkGray
    exit 1
}

# --- .env -------------------------------------------------------------------

if (-not (Test-Path '.env')) {
    Write-Step 'Creating .env'
    'DATABASE_URL="file:./dev.db"' | Out-File -FilePath '.env' -Encoding utf8
}

# --- Dependencies -----------------------------------------------------------

if (-not (Test-Path 'node_modules')) {
    Write-Step 'Installing dependencies (first run, this takes a minute)'
    npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Write-Fail 'npm install failed.'; exit 1 }
} else {
    Write-Skip 'Dependencies already installed.'
}

# --- Database ---------------------------------------------------------------

if ($Fresh) {
    if (Test-Path 'prisma/dev.db') {
        Write-Step 'Removing the existing database (-Fresh)'
        Remove-Item 'prisma/dev.db*' -Force -ErrorAction SilentlyContinue

        # SQLite keeps the file locked while a server or Prisma Studio holds it.
        # Deleting then carrying on regardless would leave the old data in place
        # while reporting a reset, so check and stop.
        if (Test-Path 'prisma/dev.db') {
            Write-Fail 'Could not delete prisma/dev.db — another process still has it open.'
            Write-Host '    Stop any running server or Prisma Studio, then run this again.' -ForegroundColor DarkGray
            exit 1
        }
    } else {
        Write-Skip 'No database to remove (-Fresh).'
    }
}

if (-not (Test-Path 'prisma/dev.db')) {
    Write-Step 'Setting up the database'
    New-Item -ItemType File -Path 'prisma/dev.db' | Out-Null
    npx prisma generate
    if ($LASTEXITCODE -ne 0) { Write-Fail 'prisma generate failed.'; exit 1 }

    npx prisma migrate deploy
    if ($LASTEXITCODE -ne 0) { Write-Fail 'prisma migrate failed.'; exit 1 }

    Write-Step 'Seeding demo data'
    npx tsx prisma/seed.ts
    if ($LASTEXITCODE -ne 0) { Write-Fail 'Seeding failed.'; exit 1 }

    Write-Host ''
    Write-Host '    Demo account:  demo@seder.app  /  demo1234' -ForegroundColor Green
    Write-Host ''
} else {
    Write-Step 'Applying pending database updates'
    npx prisma migrate deploy
    if ($LASTEXITCODE -ne 0) { Write-Fail 'prisma migrate failed.'; exit 1 }
}

# --- Build (production only) ------------------------------------------------

$url = "http://localhost:$Port/seder"

if ($Prod) {
    Write-Step 'Building for production'
    npm run build
    if ($LASTEXITCODE -ne 0) { Write-Fail 'Build failed.'; exit 1 }
}

# --- Open the browser once the server answers -------------------------------

if (-not $NoOpen) {
    # Runs alongside the server: poll until the first response, then open.
    # Without the poll the browser lands on a connection error.
    Start-Job -ScriptBlock {
        param($TargetUrl)
        for ($i = 0; $i -lt 60; $i++) {
            Start-Sleep -Milliseconds 500
            try {
                Invoke-WebRequest -Uri $TargetUrl -UseBasicParsing -TimeoutSec 2 | Out-Null
                Start-Process $TargetUrl
                return
            } catch {
                # Not up yet.
            }
        }
    } -ArgumentList $url | Out-Null
}

# --- Serve ------------------------------------------------------------------

Write-Step "Starting on $url   (Ctrl+C to stop)"
Write-Host ''

try {
    # Next is invoked directly rather than through `npm run dev -- --port`:
    # PowerShell eats the `--` separator, and the port arrives as a positional
    # argument that Next reads as a project directory.
    if ($Prod) {
        npx next start -p $Port
    } else {
        npx next dev -p $Port
    }
} finally {
    Get-Job | Remove-Job -Force -ErrorAction SilentlyContinue
}
