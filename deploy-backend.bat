@echo off
setlocal enabledelayedexpansion

set message=%~1
if "%message%"=="" set message=deploy backend

set SRC=D:\Silveroak Juniors Enquiry\SOJ Curriculum\oakit\apps\api-gateway\src
set DST=D:\Silveroak Juniors Enquiry\SOJ Curriculum\oakit\apps\ai-service\api-gateway\src
set BACKEND=D:\Silveroak Juniors Enquiry\SOJ Curriculum\oakit\apps\ai-service

echo.
echo ==========================================
echo  DEPLOY BACKEND: %message%
echo ==========================================

:: ── Step 1: Sync src/ and package.json ──────────────────────────────────────
echo.
echo [1/3] Syncing api-gateway src and package.json...
xcopy "%SRC%" "%DST%" /E /Y /I /Q
copy /Y "%BACKEND%\..\api-gateway\package.json" "%BACKEND%\api-gateway\package.json" >nul
echo Sync done.

:: ── Step 2: Commit in backend repo ──────────────────────────────────────────
echo.
echo [2/3] Committing...
cd /d "%BACKEND%"

git add -A

git diff --cached --quiet
if %errorlevel%==0 (
    echo No changes to commit.
    goto merge_main
)

git commit -m "%message%"
if %errorlevel% neq 0 ( echo ERROR: Commit failed & pause & exit /b 1 )

:: ── Step 3: Merge to main and push (Render deploys from main) ───────────────
:merge_main
echo.
echo [3/3] Merging to main and pushing...

git checkout main
if %errorlevel% neq 0 ( echo ERROR: Could not switch to main & pause & exit /b 1 )

git pull origin main --no-rebase
git merge phase3/backend --no-edit
if %errorlevel% neq 0 ( echo ERROR: Merge conflict — resolve manually & git checkout phase3/backend & pause & exit /b 1 )

git push origin main
if %errorlevel% neq 0 ( echo ERROR: Push failed & pause & exit /b 1 )

git checkout phase3/backend

echo.
echo ==========================================
echo  DONE — Render will redeploy automatically
echo  Usage: deploy-backend.bat "your message"
echo ==========================================
pause
