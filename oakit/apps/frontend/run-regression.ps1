#!/usr/bin/env pwsh
# ═══════════════════════════════════════════════════════════════════════
# OAKIT TEST RUNNER
# Runs tests, generates a rich HTML summary, and opens it in the browser.
#
# HOW TO RUN (one command):
#   .\run-regression.ps1                     # regression only  (~5 min)
#   .\run-regression.ps1 -Mode functional    # functional only  (~20 min)
#   .\run-regression.ps1 -Mode all           # everything       (~25 min)
#
# SINGLE ACTOR:
#   .\run-regression.ps1 -Mode admin
#   .\run-regression.ps1 -Mode fn:teacher
#
# REPORT:
#   After the run, two HTML files open automatically:
#     1. playwright-report/summary.html  — your custom overview
#     2. playwright-report/index.html    — Playwright's full report
#        (screenshots, traces, video for every test)
# ═══════════════════════════════════════════════════════════════════════

param(
  [string]$Mode = "regression"   # regression | functional | all | admin | principal | teacher | parent | fn:admin | fn:principal | fn:teacher | fn:parent
)

$PW = "node ..\..\node_modules\playwright\cli.js"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   OAKIT TEST RUNNER                                  ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── Check dev server ──────────────────────────────────────────
try {
  $null = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5
  Write-Host "✓ Dev server running on :3000" -ForegroundColor Green
} catch {
  Write-Host "" 
  Write-Host "✗ Dev server is NOT running!" -ForegroundColor Red
  Write-Host "  Start it first with:  npm run dev" -ForegroundColor Yellow
  Write-Host "  Then re-run this script." -ForegroundColor Yellow
  Write-Host ""
  exit 1
}

# ── Select test command ───────────────────────────────────────
$testPath = switch ($Mode) {
  "regression"   { "tests/e2e" }
  "functional"   { "tests/functional" }
  "all"          { "tests" }
  "admin"        { "tests/e2e/admin.spec.ts" }
  "principal"    { "tests/e2e/principal.spec.ts" }
  "teacher"      { "tests/e2e/teacher.spec.ts" }
  "parent"       { "tests/e2e/parent.spec.ts" }
  "fn:admin"     { "tests/functional/admin.functional.spec.ts" }
  "fn:principal" { "tests/functional/principal.functional.spec.ts" }
  "fn:teacher"   { "tests/functional/teacher.functional.spec.ts" }
  "fn:parent"    { "tests/functional/parent.functional.spec.ts" }
  default        { "tests/e2e" }
}

Write-Host ""
Write-Host "Mode     : $Mode" -ForegroundColor Yellow
Write-Host "Running  : $testPath" -ForegroundColor Gray
Write-Host "Started  : $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Gray
Write-Host ""

$startTime = Get-Date

# ── Run tests ─────────────────────────────────────────────────
Invoke-Expression "$PW test $testPath --reporter=list"
$exitCode = $LASTEXITCODE

$endTime  = Get-Date
$elapsed  = ($endTime - $startTime).TotalSeconds
$elapsedLabel = if ($elapsed -ge 60) { "$([math]::Floor($elapsed/60))m $([math]::Round($elapsed%60))s" } else { "$([math]::Round($elapsed,1))s" }

Write-Host ""
Write-Host "Finished : $(Get-Date -Format 'HH:mm:ss') (took $elapsedLabel)" -ForegroundColor Gray

# ── Generate custom summary HTML ─────────────────────────────
Write-Host ""
Write-Host "Generating summary report..." -ForegroundColor Cyan
node tests/generate-report.js

# ── Print result ──────────────────────────────────────────────
Write-Host ""
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
if ($exitCode -eq 0) {
  Write-Host "  ✅  ALL TESTS PASSED — safe to commit" -ForegroundColor Green
} else {
  Write-Host "  ❌  SOME TESTS FAILED — review report before committing" -ForegroundColor Red
}
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ── Open reports in browser ───────────────────────────────────
$summaryPath = (Resolve-Path "playwright-report/summary.html").Path
$fullPath    = (Resolve-Path "playwright-report/index.html" -ErrorAction SilentlyContinue)?.Path

Write-Host "Opening reports in browser..." -ForegroundColor Yellow
Write-Host "  Summary : $summaryPath" -ForegroundColor Gray
if ($fullPath) {
  Write-Host "  Full    : $fullPath" -ForegroundColor Gray
}
Write-Host ""

# Open summary.html directly in Chrome
Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  -ArgumentList "--new-tab `"file:///$($summaryPath.Replace('\','/'))`""

# Also start Playwright's built-in report server (has screenshots/traces)
Write-Host "Starting Playwright report server on http://localhost:9323 ..." -ForegroundColor Cyan
Write-Host "(Press Ctrl+C to stop the server when done)" -ForegroundColor Gray
Write-Host ""
Invoke-Expression "$PW show-report playwright-report --host localhost --port 9323"
