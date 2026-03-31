@echo off
:: myspotify — hosts file setup
:: Run as Administrator to add http://myspotify shortcut
:: This only needs to be run ONCE during installation

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo.
echo  myspotify — setting up local URL
echo  ===================================

:: Add to hosts file if not already there
findstr /C:"myspotify" "%SystemRoot%\System32\drivers\etc\hosts" >nul 2>&1
if %errorLevel% equ 0 (
    echo  [OK] http://myspotify is already configured
) else (
    echo 127.0.0.1    myspotify >> "%SystemRoot%\System32\drivers\etc\hosts"
    echo  [OK] Added: 127.0.0.1 myspotify
)

echo.
echo  You can now use http://myspotify in any browser.
echo  Also add this to your Spotify Developer Dashboard:
echo  Redirect URI: http://myspotify/callback
echo.
pause
