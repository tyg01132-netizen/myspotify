@echo off
title myspotify
color 0A
cls

echo.
echo  =============================================
echo   myspotify — personal Spotify client
echo  =============================================
echo.

REM Create venv if needed
if not exist "venv" (
    echo  Setting up for the first time...
    python -m venv venv
    echo  Installing dependencies...
    venv\Scripts\pip install flask requests --quiet
    echo  Done!
    echo.
)

REM Start Flask in background
echo  Starting server on http://127.0.0.1:5001
start "" /B venv\Scripts\python app.py

REM Wait a moment then open browser
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:5001"

echo  Browser opened. Press Ctrl+C to stop the server.
echo.

REM Keep window open showing server output
venv\Scripts\python app.py
pause
