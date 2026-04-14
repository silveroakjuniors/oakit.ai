@echo off
setlocal

set ROOT=D:\Silveroak Juniors Enquiry\SOJ Curriculum
set SRC=%ROOT%\oakit\apps\api-gateway
set DEST=%ROOT%\oakit\apps\ai-service\api-gateway

echo ============================================
echo  Step 1: Creating api-gateway folder
echo ============================================
if not exist "%DEST%" mkdir "%DEST%"
if not exist "%DEST%\src" mkdir "%DEST%\src"

echo ============================================
echo  Step 2: Copying api-gateway source files
echo ============================================
robocopy "%SRC%\src" "%DEST%\src" /E /NFL /NDL /NJH /NJS
if %ERRORLEVEL% GEQ 8 (
    echo ERROR: robocopy failed with code %ERRORLEVEL%
    pause
    exit /b 1
)

echo ============================================
echo  Step 3: Copying config files
echo ============================================
copy /Y "%SRC%\package.json"    "%DEST%\package.json"
copy /Y "%SRC%\tsconfig.json"   "%DEST%\tsconfig.json"
copy /Y "%SRC%\Procfile"        "%DEST%\Procfile"
copy /Y "%SRC%\nixpacks.toml"   "%DEST%\nixpacks.toml"

REM .gitignore needs special handling (hidden file)
if exist "%SRC%\.gitignore" (
    copy /Y "%SRC%\.gitignore" "%DEST%\.gitignore"
) else (
    echo # api-gateway gitignore > "%DEST%\.gitignore"
    echo node_modules/ >> "%DEST%\.gitignore"
    echo dist/ >> "%DEST%\.gitignore"
    echo .env >> "%DEST%\.gitignore"
    echo uploads/ >> "%DEST%\.gitignore"
)

echo ============================================
echo  Step 4: Committing to oakit-backend repo
echo ============================================
cd /d "%ROOT%\oakit\apps\ai-service"

git add .
git status
git commit -m "Add api-gateway service + runtime.txt for ai-service"
if %ERRORLEVEL% NEQ 0 (
    echo Nothing to commit or commit failed
)

echo ============================================
echo  Step 5: Pushing to GitHub (oakit-backend)
echo ============================================
git push origin main
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Push failed. Check your credentials.
    pause
    exit /b 1
)

echo ============================================
echo  Step 6: Pushing frontend to oakit.ai repo
echo ============================================
cd /d "%ROOT%\oakit"

git add .
git status
git commit -m "feat: security, audit logs, student management, branding, AI safety, deployment config"
if %ERRORLEVEL% NEQ 0 (
    echo Nothing to commit or commit failed
)

git push origin feature/Curriculum
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Frontend push failed. Check your credentials.
    pause
    exit /b 1
)

echo ============================================
echo  DONE! Both repos pushed successfully.
echo ============================================
echo.
echo  oakit-backend: https://github.com/silveroakjuniors/oakit-backend.git
echo  oakit.ai:      https://github.com/silveroakjuniors/oakit.ai.git (feature/Curriculum)
echo.
pause
