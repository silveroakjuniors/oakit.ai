@echo off
echo Starting Oakit Dev Servers...

:: API Gateway (Node/TypeScript) — port 3001
start "API Gateway" cmd /k "cd /d %~dp0apps\api-gateway && npm run dev"

:: Frontend (Next.js) — port 3000
start "Frontend" cmd /k "cd /d %~dp0apps\frontend && npm run dev"

:: AI Service (FastAPI/Python) — port 8000
start "AI Service" cmd /k "cd /d %~dp0apps\ai-service && venv\Scripts\activate && uvicorn main:app --reload --port 8000"

echo All 3 servers started in separate windows.
