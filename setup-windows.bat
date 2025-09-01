@echo off
echo ===========================================
echo IoT Smart Classroom - Windows Setup Script
echo ===========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please download and install Node.js from: https://nodejs.org/
    pause
    exit /b 1
)

REM Check if npm is available
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm is not available!
    echo Please reinstall Node.js which includes npm.
    pause
    exit /b 1
)

echo ✓ Node.js and npm are installed
echo.

REM Install frontend dependencies
echo Installing frontend dependencies...
if not exist "node_modules" (
    npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install frontend dependencies!
        pause
        exit /b 1
    )
) else (
    echo ✓ Frontend dependencies already installed
)
echo.

REM Install backend dependencies
echo Installing backend dependencies...
cd backend
if not exist "node_modules" (
    npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install backend dependencies!
        cd ..
        pause
        exit /b 1
    )
) else (
    echo ✓ Backend dependencies already installed
)
cd ..
echo.

REM Check if .env files exist
if not exist ".env" (
    echo Creating .env file...
    echo VITE_API_BASE_URL=http://172.16.3.171:3001/api> .env
    echo VITE_WEBSOCKET_URL=http://172.16.3.171:3001>> .env
    echo VITE_API_BASE_URL_EXTRA=http://192.168.0.108:3001/api>> .env
    echo VITE_WEBSOCKET_URL_EXTRA=http://192.168.0.108:3001>> .env
    echo VITE_API_BASE_URL_LOCAL=http://localhost:3001/api>> .env
    echo VITE_WEBSOCKET_URL_LOCAL=http://localhost:3001>> .env
    echo ✓ Created .env file
) else (
    echo ✓ .env file already exists
)

if not exist "backend\.env" (
    echo Creating backend/.env file...
    echo NODE_ENV=development> backend\.env
    echo PORT=3001>> backend\.env
    echo HOST=172.16.3.171>> backend\.env
    echo MONGODB_URI=your_mongodb_connection_string>> backend\.env
    echo JWT_SECRET=your_jwt_secret_key>> backend\.env
    echo JWT_EXPIRES_IN=7d>> backend\.env
    echo.>> backend\.env
    echo # Email Configuration>> backend\.env
    echo EMAIL_SERVICE=gmail>> backend\.env
    echo EMAIL_USERNAME=your-email@gmail.com>> backend\.env
    echo EMAIL_PASSWORD=your-app-specific-password>> backend\.env
    echo EMAIL_FROM=your-email@gmail.com>> backend\.env
    echo.>> backend\.env
    echo # Security Settings>> backend\.env
    echo RATE_LIMIT_WINDOW=15>> backend\.env
    echo RATE_LIMIT_MAX_REQUESTS=100>> backend\.env
    echo API_RATE_LIMIT_WINDOW=15>> backend\.env
    echo API_RATE_LIMIT_MAX_REQUESTS=50>> backend\.env
    echo ✓ Created backend/.env file
) else (
    echo ✓ backend/.env file already exists
)

echo.
echo ===========================================
echo Setup Complete!
echo ===========================================
echo.
echo IMPORTANT: Before running the application:
echo.
echo 1. Update backend/.env with your MongoDB connection string
echo 2. Update backend/.env with your JWT secret
echo 3. If your IP address is different from 172.16.3.171, update:
echo    - .env (VITE_API_BASE_URL and VITE_WEBSOCKET_URL)
echo    - backend/.env (HOST)
echo    - backend/server.js (CORS origins)
echo.
echo To start the application:
echo.
echo Terminal 1 - Backend:
echo   cd backend
echo   npm start
echo.
echo Terminal 2 - Frontend:
echo   npm run dev
echo.
echo Then open: http://172.16.3.171:5173
echo.
echo For network access from other devices:
echo   http://172.16.3.171:5173
echo.
pause
