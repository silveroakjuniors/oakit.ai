@echo off
setlocal enabledelayedexpansion

:: ==============================
:: INPUT
:: ==============================
set message=%~1
if "%message%"=="" (
    set message=updated Phase 2
)

:: ==============================
:: PATHS
:: ==============================
set OAKIT_PATH=D:\Silveroak Juniors Enquiry\SOJ Curriculum\oakit
set BACKEND_PATH=D:\Silveroak Juniors Enquiry\SOJ Curriculum\oakit\apps\ai-service
set PHASE2_BRANCH=phase2/curriculum
set BACKEND_BRANCH=phase2/backend

echo ==========================================
echo  STARTING FULL DEPLOY: %message%
echo ==========================================

:: =====================================================
:: STEP 1: OAKIT REPO — commit phase2, merge to main
:: =====================================================
echo.
echo [1/4] OAKIT — committing phase2/curriculum...
cd /d "%OAKIT_PATH%"

if not exist ".git" (
    echo ERROR: OAKIT repo not found
    exit /b 1
)

:: Make sure we're on phase2/curriculum
git checkout %PHASE2_BRANCH%
if %errorlevel% neq 0 (
    echo ERROR: Could not switch to %PHASE2_BRANCH%
    exit /b 1
)

git add -A

git diff --cached --quiet
if %errorlevel%==0 (
    echo No changes to commit on %PHASE2_BRANCH%
) else (
    git commit -m "%message%"
    if %errorlevel% neq 0 (
        echo ERROR: Commit failed
        exit /b 1
    )
)

echo Pushing %PHASE2_BRANCH%...
git push origin %PHASE2_BRANCH%
if %errorlevel% neq 0 (
    echo ERROR: Push to %PHASE2_BRANCH% failed
    exit /b 1
)

echo Merging into main...
git checkout main
git pull origin main
git merge %PHASE2_BRANCH% --no-edit
if %errorlevel% neq 0 (
    echo ERROR: Merge conflict — resolve manually
    git checkout %PHASE2_BRANCH%
    exit /b 1
)

git push origin main
if %errorlevel% neq 0 (
    echo ERROR: Push to main failed
    exit /b 1
)

echo Back to %PHASE2_BRANCH%...
git checkout %PHASE2_BRANCH%

:: =====================================================
:: STEP 2: SYNC api-gateway to ai-service
:: =====================================================
echo.
echo [2/4] Syncing api-gateway to ai-service...

if exist "%BACKEND_PATH%\api-gateway" (
    rmdir /s /q "%BACKEND_PATH%\api-gateway"
)
mkdir "%BACKEND_PATH%\api-gateway"

for /r "%OAKIT_PATH%\apps\api-gateway" %%f in (*) do (
    set "dest=%%f"
    set "dest=!dest:%OAKIT_PATH%\apps\api-gateway=%BACKEND_PATH%\api-gateway!"
    if not exist "!dest!\.." mkdir "!dest!\.." >nul 2>&1
    copy "%%f" "!dest!" >nul
)

echo API Gateway synced.

:: =====================================================
:: STEP 3: AI-SERVICE REPO — commit phase2/backend
:: =====================================================
echo.
echo [3/4] AI-SERVICE — committing %BACKEND_BRANCH%...
cd /d "%BACKEND_PATH%"

if not exist ".git" (
    echo ERROR: Backend repo not found
    exit /b 1
)

git checkout %BACKEND_BRANCH%
if %errorlevel% neq 0 (
    echo ERROR: Could not switch to %BACKEND_BRANCH%
    exit /b 1
)

git add -A

git diff --cached --quiet
if %errorlevel%==0 (
    echo No changes to commit on %BACKEND_BRANCH%
) else (
    git commit -m "%message%"
    if %errorlevel% neq 0 (
        echo ERROR: Backend commit failed
        exit /b 1
    )
)

git push origin %BACKEND_BRANCH%
if %errorlevel% neq 0 (
    echo ERROR: Push to %BACKEND_BRANCH% failed
    exit /b 1
)

:: =====================================================
:: STEP 4: AI-SERVICE — merge phase2/backend to main
:: =====================================================
echo.
echo [4/4] AI-SERVICE — merging to main...
git checkout main
git pull origin main
git merge %BACKEND_BRANCH% --no-edit
if %errorlevel% neq 0 (
    echo ERROR: Backend merge conflict — resolve manually
    git checkout %BACKEND_BRANCH%
    exit /b 1
)

git push origin main
if %errorlevel% neq 0 (
    echo ERROR: Backend push to main failed
    exit /b 1
)

git checkout %BACKEND_BRANCH%

:: =====================================================
:: DONE
:: =====================================================
echo.
echo ==========================================
echo  DEPLOY COMPLETE: %message%
echo  - oakit.ai: phase2/curriculum + main
echo  - oakit-backend: phase2/backend + main
echo ==========================================
pause
