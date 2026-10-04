param(
    [string]$Server = 'root@vee-app.co.il',
    [string]$Branch = 'main',
    [string]$CommitMessage = 'Improve Seder workspace and collaboration',
    [switch]$SkipGithub,
    [switch]$SkipE2E,
    [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
Set-Location -LiteralPath $projectRoot
if ($Server -notmatch '^[a-zA-Z0-9_.@-]+$') { throw 'Invalid server.' }
if ($Branch -notmatch '^[a-zA-Z0-9_/-]+$') { throw 'Invalid branch.' }
$previousDatabase = $env:DATABASE_URL
$previousDist = $env:NEXT_DIST_DIR
$previousUrl = $env:APP_URL
$archive = $null

function Check-Exit([string]$Message) { if ($LASTEXITCODE -ne 0) { throw $Message } }

try {
    Write-Host '[INFO] Validating Seder against a separate local database...'
    $nodeVersion = [version]((& node --version).TrimStart('v'))
    Check-Exit 'Node.js is unavailable.'
    if ($nodeVersion -lt [version]'22.12.0') { throw 'Node.js 22.12 or newer is required.' }
    & npm ci; Check-Exit 'Dependency installation failed.'
    $env:DATABASE_URL = 'file:./deploy-validation.db'
    $validationDb = Join-Path $projectRoot 'prisma/deploy-validation.db'
    if (!(Test-Path -LiteralPath $validationDb)) { New-Item -ItemType File -Path $validationDb | Out-Null }
    & npx prisma migrate deploy; Check-Exit 'Validation database migration failed.'
    & npm run typecheck; Check-Exit 'Typecheck failed.'
    & npm test; Check-Exit 'Unit tests failed.'
    & node scripts/contrast-check.mjs; Check-Exit 'Contrast check failed.'
    $env:NEXT_DIST_DIR = '.next-deploy-check'
    $env:APP_URL = 'http://localhost:3100/seder'
    & npm run build; Check-Exit 'Production build failed.'
    if (!$SkipE2E) { & npm run test:e2e; Check-Exit 'Browser tests failed.' }
    if ($ValidateOnly) { Write-Host '[SUCCESS] Validation passed. Nothing was published.'; return }

    Write-Host '[INFO] Saving the exact release to GitHub...'
    $currentBranch = (& git branch --show-current).Trim(); Check-Exit 'Cannot read Git branch.'
    if ($currentBranch -ne $Branch) { throw "Run from branch $Branch; current branch is $currentBranch." }
    if (!$SkipGithub) {
        & git fetch origin $Branch; Check-Exit 'Cannot fetch GitHub.'
        & git merge-base --is-ancestor "origin/$Branch" HEAD
        Check-Exit 'GitHub contains changes missing locally. Merge them before deploying; no force push was attempted.'
    }
    $secretPaths = & git ls-files -- '.env' '.env.production' '.env.*.local' '*.pem' '*.key'
    if ($secretPaths) { throw 'Secret files are tracked. Remove them from Git before publishing.' }
    & git add --all; Check-Exit 'Could not stage the release.'
    & git diff --cached --quiet
    if ($LASTEXITCODE -eq 1) { & git commit -m $CommitMessage; Check-Exit 'Could not commit the release.' }
    elseif ($LASTEXITCODE -ne 0) { throw 'Could not inspect staged changes.' }
    $commit = (& git rev-parse HEAD).Trim(); Check-Exit 'Could not read release commit.'
    if (!$SkipGithub) { & git push origin "HEAD:$Branch"; Check-Exit 'GitHub push failed; production was not changed.' }

    $releaseId = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + $commit.Substring(0, 8)
    $archive = Join-Path ([System.IO.Path]::GetTempPath()) "seder-$releaseId.tar.gz"
    $remoteArchive = "/tmp/seder-$releaseId.tar.gz"
    & git archive --format=tar.gz "--output=$archive" HEAD; Check-Exit 'Could not package the committed source.'
    Write-Host '[INFO] Uploading the release. Secrets and databases are excluded by Git.'
    & scp $archive "${Server}:$remoteArchive"; Check-Exit 'Upload failed.'
    $deploymentScript = Get-Content -LiteralPath (Join-Path $projectRoot 'scripts/deploy-release.sh') -Raw
    $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($deploymentScript.Replace("`r`n", "`n")))
    & ssh -o BatchMode=yes $Server "echo $encoded | base64 -d | bash -s -- '$remoteArchive' '$releaseId' '$commit'"
    Check-Exit "Production release failed. GitHub commit $commit remains available; server rollback details are in the output."
    $health = Invoke-RestMethod -Uri 'https://lawebs.co.il/seder/api/health' -TimeoutSec 20
    if ($health.status -ne 'ok' -or $health.release -ne $commit) { throw 'Public release verification failed.' }
    if (!$health.mailConfigured) { Write-Warning 'Production is live, but real email delivery is not configured.' }
    Write-Host "[SUCCESS] GitHub and production are on $commit : https://lawebs.co.il/seder"
}
finally {
    $env:DATABASE_URL = $previousDatabase
    $env:NEXT_DIST_DIR = $previousDist
    $env:APP_URL = $previousUrl
    if ($archive -and (Test-Path -LiteralPath $archive)) { Remove-Item -LiteralPath $archive -Force }
}
