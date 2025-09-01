@echo off
echo ===========================================
echo IoT Smart Classroom - IP Configuration
echo ===========================================
echo.

echo Detecting your IP address...

REM Get IP address on Windows
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R /C:"IPv4 Address"') do (
    for /f "tokens=*" %%b in ("%%a") do set CURRENT_IP=%%b
    goto :found_ip
)

:found_ip
set CURRENT_IP=%CURRENT_IP: =%
echo Your current IP address: %CURRENT_IP%
echo.

set /p TARGET_IP="Enter the IP address to configure (press Enter to use %CURRENT_IP%): "
if "%TARGET_IP%"=="" set TARGET_IP=%CURRENT_IP%

echo.
echo Configuring application for IP: %TARGET_IP%
echo.

REM Create backup and update .env
echo Updating frontend configuration...
if exist ".env" (
    copy ".env" ".env.bak" >nul
    powershell -Command "(Get-Content .env) -replace 'http://[^:]*:3001', 'http://%TARGET_IP%:3001' | Set-Content .env"
    echo ✓ Updated .env
) else (
    echo ❌ .env file not found!
)

REM Create backup and update backend/.env
echo Updating backend configuration...
if exist "backend\.env" (
    copy "backend\.env" "backend\.env.bak" >nul
    powershell -Command "(Get-Content backend\.env) -replace 'HOST=.*', 'HOST=%TARGET_IP%' | Set-Content backend\.env"
    echo ✓ Updated backend/.env
) else (
    echo ❌ backend/.env file not found!
)

REM Create backup and update server.js
echo Updating CORS configuration...
if exist "backend\server.js" (
    copy "backend\server.js" "backend\server.js.bak" >nul
    powershell -Command "(Get-Content backend\server.js) -replace 'http://[^:]*:5173', 'http://%TARGET_IP%:5173' | Set-Content backend\server.js"
    powershell -Command "(Get-Content backend\server.js) -replace 'http://[^:]*:5174', 'http://%TARGET_IP%:5174' | Set-Content backend\server.js"
    powershell -Command "(Get-Content backend\server.js) -replace 'http://[^:]*:5175', 'http://%TARGET_IP%:5175' | Set-Content backend\server.js"
    echo ✓ Updated backend/server.js
) else (
    echo ❌ backend/server.js file not found!
)

echo.
echo ===========================================
echo Configuration Complete!
echo ===========================================
echo.
echo Application configured for IP: %TARGET_IP%
echo.
echo To start the application:
echo.
echo Terminal 1 - Backend:
echo   cd backend ^& npm start
echo.
echo Terminal 2 - Frontend:
echo   npm run dev
echo.
echo Access URLs:
echo   Frontend: http://%TARGET_IP%:5173
echo   Backend API: http://%TARGET_IP%:3001/api
echo   Health Check: http://%TARGET_IP%:3001/api/health
echo.
echo Backup files created with .bak extension
echo.
pause
