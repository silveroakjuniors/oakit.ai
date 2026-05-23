@echo off
setlocal enabledelayedexpansion

set "message=%~1"
if "%message%"=="" set "message=deploy backend"

set "SRC=D:\Silveroak Juniors Enquiry\SOJ Curriculum\oakit\apps\api-gateway\src"
set "DST=D:\Silveroak Juniors Enquiry\SOJ Curriculum\oakit\apps\ai-service\api-gateway\src"
set "PKG_SRC=D:\Silveroak Juniors Enquiry\SOJ Curriculum\oakit\apps\api-gateway\package.json"
set "PKG_DST=D:\Silveroak Juniors Enquiry\SOJ Curriculum\oakit\apps\ai-service\api-gateway\package.json"
set "BACKEND=D:\Silveroak Juniors Enquiry\SOJ Curriculum\oakit\apps\ai-service"

echo.
echo ==========================================
echo  DEPLOY BACKEND: %message%
echo ==========================================

:: ── Step 1: Sync src/ and package.json ──────────────────────────────────────
echo.
echo [1/4] Syncing api-gateway src and package.json...
xcopy "%SRC%" "%DST%" /E /Y /I /Q
copy /Y "%PKG_SRC%" "%PKG_DST%" >nul
echo      Sync done.

:: ── Step 2: Also sync Python files (main.py, etc.) ─────────────────────────
echo.
echo [2/4] Checking for Python file changes...
echo      (Python files are tracked directly in ai-service root)

:: ── Step 3: Commit in backend repo ──────────────────────────────────────────
echo.
echo [3/4] Committing in ai-service repo...
pushd "%BACKEND%"

git add -A

git diff --cached --quiet
if !errorlevel!==0 (
    echo      No changes to commit.
    goto :do_push
)

git commit -m "%message%"
if !errorlevel! neq 0 (
    echo ERROR: Commit failed
    popd
    pause
    exit /b 1
)

:: ── Step 4: Push to main (Render deploys from main) ─────────────────────────
:do_push
echo.
echo [4/4] Pushing to main...

:: Make sure we're on main
git checkout main 2>nul
if !errorlevel! neq 0 (
    echo      Already on main or switch failed, continuing...
)

:: If there's a phase3/backend branch with newer commits, merge it
git log phase3/backend --oneline -1 >nul 2>&1
if !errorlevel!==0 (
    git merge phase3/backend --no-edit 2>nul
)

git push origin main
if !errorlevel! neq 0 (
    echo ERROR: Push to origin main failed
    popd
    pause
    exit /b 1
)

popd

echo.
echo ==========================================
echo  DONE — Render will redeploy automatically
echo  Usage: deploy-backend.bat "your message"
echo ==========================================
pause
