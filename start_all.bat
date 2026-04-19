@echo off
echo Starting AIVA Servers...

echo Starting Main Backend (Flask)...
start "AIVA Main Backend" cmd /k "cd backend && python app.py"

echo Starting Code Editor Frontend (React)...
start "Code Editor UI" cmd /k "cd ""CODE EDITOR\ai-interview-ide"" && npm start"

echo Starting Code Editor Backend (Flask)...
start "Code Editor Backend" cmd /k "cd ""CODE EDITOR\backend"" && python app.py"

echo Starting Meeting UI Frontend (Vite)...
start "Meeting UI Client" cmd /k "cd ""MEETING UI\AIVA1\client"" && npm run dev"

echo Starting Meeting UI Backend (Node)...
start "Meeting UI Server" cmd /k "cd ""MEETING UI\AIVA1\server"" && npm run dev"

echo All servers are starting up in separate windows!
echo.
echo  AIVA Dashboard    : http://localhost:5000
echo.
