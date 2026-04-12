@echo off
chcp 65001 >nul
echo Starting DeepDemo1...

start "Backend" cmd /k "cd /d %~dp0backend && uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload"
start "Frontend" cmd /k "cd /d %~dp0frontend && npx vite"

echo Backend: http://127.0.0.1:8001
echo Frontend: http://127.0.0.1:3000
