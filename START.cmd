@echo off
setlocal
cd /d "%~dp0"
set "NODE_EXE=node"
where node >nul 2>&1
if not errorlevel 1 goto run
set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%NODE_EXE%" (
  echo Node.js was not found. Open this folder in Codex Desktop and run: npm start
  pause
  exit /b 1
)
:run
start "" "http://127.0.0.1:4317"
"%NODE_EXE%" server.cjs
