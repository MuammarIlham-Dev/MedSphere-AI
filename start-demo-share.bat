@echo off
setlocal EnableDelayedExpansion

title MedSphere AI - Demo Share via Cloudflare Tunnel
color 0A

echo ============================================
echo   MedSphere AI - Quick Demo Share
echo ============================================
echo.

:: Check if npm is available
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] npm is not installed or not in PATH
    pause
    exit /b 1
)

:: Check if cloudflared is available
where cloudflared >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] cloudflared is not installed or not in PATH
    echo Install it from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
    pause
    exit /b 1
)

echo [1/2] Starting development server...
echo.

:: Start npm dev server in a new window (with --host enabled)
start "MedSphere AI Dev Server" cmd /c "cd /d %~dp0 && npm run dev -- --host"

:: Wait for dev server to start
echo Waiting for dev server to start...
timeout /t 5 /nobreak >nul

echo.
echo [2/2] Starting Cloudflare Quick Tunnel...
echo.

:: Create a temporary file for cloudflared output
set "TMPFILE=%TEMP%\cloudflared_output_%RANDOM%.txt"
if exist "%TMPFILE%" del "%TMPFILE%"

:: Start cloudflared quick tunnel in background and redirect output
start "Cloudflare Tunnel" cmd /c "cloudflared tunnel --no-autoupdate --url http://localhost:5173 --http-host-header localhost > "%TMPFILE%" 2>&1"

echo Waiting for Cloudflare URL...
set "TUNNEL_URL="
set "MAX_TRIES=15"
set "TRIES=0"

:wait_for_url
timeout /t 2 /nobreak >nul
set /a TRIES+=1

for /f "tokens=*" %%a in ('findstr /r "https://.*trycloudflare.com" "%TMPFILE%" 2^>nul') do (
    set "LINE=%%a"
    for %%u in (!LINE!) do (
        echo %%u | findstr /i "https://.*trycloudflare.com" >nul 2>nul
        if !ERRORLEVEL! equ 0 (
            set "TUNNEL_URL=%%u"
            goto :found_url
        )
    )
)

if %TRIES% lss %MAX_TRIES% goto :wait_for_url

echo [ERROR] Could not get Cloudflare Tunnel URL.
echo Check "%TMPFILE%" for errors:
type "%TMPFILE%"
pause
goto :cleanup

:found_url
echo.
echo ============================================
echo   SHARE THE URL BELOW WITH YOUR TEAM
echo ============================================
echo.
echo   URL: !TUNNEL_URL!
echo.
echo ======================================
echo   SCAN QR CODE TO OPEN ON PHONE
echo ======================================
echo.

:: Generate QR code
call npx -y qrcode-terminal "!TUNNEL_URL!"

echo.
echo No password needed - just open the link!
echo.
echo Press any key to stop the tunnel and dev server...
pause >nul

:cleanup
:: Clean up
del "%TMPFILE%" 2>nul
taskkill /fi "WINDOWTITLE eq Cloudflare Tunnel" >nul 2>nul
taskkill /fi "WINDOWTITLE eq MedSphere AI Dev Server" >nul 2>nul

echo.
echo Tunnel and dev server stopped.
endlocal

:: Pause slightly before closing
timeout /t 2 /nobreak >nul
