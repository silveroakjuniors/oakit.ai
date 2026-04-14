#!/usr/bin/env powershell
<#
.SYNOPSIS
OakIT Premium UI - Auto Route Integration Script
Automatically updates all route files to use premium pages

.DESCRIPTION
Replaces all old route exports with new premium page exports
No manual editing needed!

.EXAMPLE
.\update-routes.ps1
#>

# Set error action preference
$ErrorActionPreference = "Stop"

# Get the script directory
$scriptDir = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition
$frontendRoot = "$scriptDir"

Write-Host "🚀 OakIT Premium UI - Route Updater" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📁 Frontend root: $frontendRoot" -ForegroundColor Gray

# Check if we're in the right directory
if (-not (Test-Path "$frontendRoot/src/app/admin")) {
    Write-Host "❌ ERROR: Cannot find src/app/admin folder" -ForegroundColor Red
    Write-Host "Make sure to run this script from the frontend root folder" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Found src/app/admin folder" -ForegroundColor Green
Write-Host ""

# Define all route updates
$routeUpdates = @(
    @{
        path = "src/app/admin/users/page.tsx"
        content = "export { default } from '@/features/admin/users/AdminUsersPagePremium';"
        name = "Users Page"
    },
    @{
        path = "src/app/admin/classes/page.tsx"
        content = "export { default } from '@/features/admin/classes/AdminClassesPagePremium';"
        name = "Classes Page"
    },
    @{
        path = "src/app/admin/students/page.tsx"
        content = "export { default } from '@/features/admin/students/AdminStudentsPagePremium';"
        name = "Students Page"
    },
    @{
        path = "src/app/admin/curriculum/page.tsx"
        content = "export { default } from '@/features/admin/curriculum/AdminCurriculumPagePremium';"
        name = "Curriculum Page"
    },
    @{
        path = "src/app/admin/plans/page.tsx"
        content = "export { default } from '@/features/admin/plans/AdminPlansPagePremium';"
        name = "Plans Page"
    },
    @{
        path = "src/app/admin/announcements/page.tsx"
        content = "export { default } from '@/features/admin/announcements/AdminAnnouncementsPagePremium';"
        name = "Announcements Page"
    },
    @{
        path = "src/app/admin/calendar/page.tsx"
        content = "export { default } from '@/features/admin/calendar/AdminCalendarPagePremium';"
        name = "Calendar Page"
    },
    @{
        path = "src/app/admin/audit/page.tsx"
        content = "export { default } from '@/features/admin/audit/AdminAuditPagePremium';"
        name = "Audit Page"
    },
    @{
        path = "src/app/student/page.tsx"
        content = "export { default } from '@/features/student/StudentPage.premium';"
        name = "Student Dashboard"
    }
)

Write-Host "📝 Updating routes..." -ForegroundColor Yellow
Write-Host ""

$successCount = 0
$failureCount = 0

foreach ($update in $routeUpdates) {
    $fullPath = Join-Path $frontendRoot $update.path
    
    try {
        $dir = Split-Path -Parent $fullPath
        
        # Create directory if it doesn't exist
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-Host "  📁 Created directory: $($update.path.Split('/')[0..(-2)] -join '/')" -ForegroundColor Cyan
        }
        
        # Write the content
        Set-Content -Path $fullPath -Value $update.content -Encoding UTF8 -Force
        Write-Host "  ✅ $($update.name)" -ForegroundColor Green
        $successCount++
    }
    catch {
        Write-Host "  ❌ $($update.name) - Error: $_" -ForegroundColor Red
        $failureCount++
    }
}

Write-Host ""
Write-Host "===================================" -ForegroundColor Cyan

# Create settings theme page
$settingsPath = Join-Path $frontendRoot "src/app/admin/settings/page.tsx"
$settingsDir = Split-Path -Parent $settingsPath

try {
    if (-not (Test-Path $settingsDir)) {
        New-Item -ItemType Directory -Path $settingsDir -Force | Out-Null
    }
    
    $settingsContent = "export { default } from '@/features/admin/settings/AdminSettingsThemePage';"
    Set-Content -Path $settingsPath -Value $settingsContent -Encoding UTF8 -Force
    Write-Host "✅ Settings → Theme page created" -ForegroundColor Green
    $successCount++
}
catch {
    Write-Host "❌ Settings page - Error: $_" -ForegroundColor Red
    $failureCount++
}

Write-Host ""
Write-Host "📊 Summary:" -ForegroundColor Cyan
Write-Host "  ✅ Success: $successCount" -ForegroundColor Green
Write-Host "  ❌ Failed: $failureCount" -ForegroundColor $(if ($failureCount -eq 0) { "Green" } else { "Red" })

Write-Host ""

if ($failureCount -eq 0) {
    Write-Host "🎉 All routes updated successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Run: npm run dev" -ForegroundColor Gray
    Write-Host "  2. Visit: http://localhost:3000/admin" -ForegroundColor Gray
    Write-Host "  3. Go to: Settings → Theme to customize colors" -ForegroundColor Gray
    Write-Host "  4. Change theme color and watch entire app update!" -ForegroundColor Gray
    Write-Host ""
    Write-Host "🌟 All 10 premium pages now active with dark green branding!" -ForegroundColor Green
}
else {
    Write-Host "⚠️  Some routes failed to update. Please check the errors above." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
