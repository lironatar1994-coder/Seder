param(
    [string]$Server = 'root@vee-app.co.il'
)

$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$archiveName = "seder-$timestamp.tar.gz"
$localArchive = Join-Path ([System.IO.Path]::GetTempPath()) $archiveName
$localBuildDir = '.next-deploy-check'
$localBuildOutput = Join-Path $projectRoot $localBuildDir
$remoteArchive = "/tmp/$archiveName"
$remoteRelease = "/root/Seder.release-$timestamp"
$remoteCurrent = '/root/Seder'
$remotePrevious = "/root/Seder.previous-$timestamp"
$remoteDb = '/var/lib/seder/seder.db'
$remoteDbBackup = "/root/deployment-backups/seder/seder-$timestamp.db"

try {
    Write-Host '[INFO] Running local checks...'
    & npm run typecheck
    if ($LASTEXITCODE -ne 0) { throw 'Typecheck failed.' }
    & npm test
    if ($LASTEXITCODE -ne 0) { throw 'Unit tests failed.' }
    & node scripts/contrast-check.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Contrast check failed.' }
    $previousDistDir = $env:NEXT_DIST_DIR
    try {
        $env:NEXT_DIST_DIR = $localBuildDir
        & npx next build
        if ($LASTEXITCODE -ne 0) { throw 'Production build failed.' }
    }
    finally {
        $env:NEXT_DIST_DIR = $previousDistDir
    }

    Write-Host '[INFO] Building the deployment archive...'
    & tar.exe -czf $localArchive `
        --exclude=node_modules `
        --exclude='.next*' `
        --exclude=.git `
        --exclude=.env `
        --exclude='.env.*' `
        --exclude='*.db' `
        --exclude='*.db-*' `
        --exclude='*.tsbuildinfo' `
        --exclude=test-results `
        --exclude=playwright-report `
        --exclude=screenshots `
        -C $projectRoot .
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the deployment archive.' }

    Write-Host '[INFO] Uploading Seder...'
    & scp $localArchive "${Server}:$remoteArchive"
    if ($LASTEXITCODE -ne 0) { throw 'Archive upload failed.' }

    $remoteScript = @"
set -euo pipefail
release='$remoteRelease'
current='$remoteCurrent'
previous='$remotePrevious'
archive='$remoteArchive'
database='$remoteDb'
database_backup='$remoteDbBackup'

install -d -m 700 /root/deployment-backups/seder
rm -rf -- "`$release"
install -d -m 755 "`$release"
tar -xzf "`$archive" -C "`$release"

had_database=0
if [ -f "`$database" ]; then
  had_database=1
  sqlite3 "`$database" ".backup '`$database_backup'"
fi

if [ -d "`$current" ]; then mv "`$current" "`$previous"; fi
mv "`$release" "`$current"

if ! (cd "`$current" && bash ./deploy_linux.sh); then
  pm2 delete seder-live >/dev/null 2>&1 || true
  rm -rf -- "`$current"
  if [ -d "`$previous" ]; then
    mv "`$previous" "`$current"
    (cd "`$current" && pm2 startOrReload ecosystem.config.cjs --only seder-live --update-env) || true
  fi
  if [ "`$had_database" -eq 1 ] && [ -f "`$database_backup" ]; then
    install -m 600 "`$database_backup" "`$database"
  elif [ "`$had_database" -eq 0 ]; then
    rm -f -- "`$database"
  fi
  exit 1
fi

rm -rf -- "`$previous"
rm -f -- "`$archive"
find /root/deployment-backups/seder -type f -name 'seder-*.db' -printf '%T@ %p\n' 2>/dev/null | sort -nr | tail -n +8 | cut -d' ' -f2- | xargs -r rm -f --
"@
    $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($remoteScript))
    & ssh $Server "echo $encoded | base64 -d | bash"
    if ($LASTEXITCODE -ne 0) { throw 'Remote deployment failed; the previous release was restored when available.' }

    Write-Host '[SUCCESS] Seder deployed: https://lawebs.co.il/seder'
}
finally {
    if (Test-Path -LiteralPath $localArchive -PathType Leaf) {
        Remove-Item -LiteralPath $localArchive -Force
    }
    if (Test-Path -LiteralPath $localBuildOutput -PathType Container) {
        Remove-Item -LiteralPath $localBuildOutput -Recurse -Force
    }
}
