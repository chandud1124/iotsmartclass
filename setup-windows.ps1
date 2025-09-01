# IoT Smart Classroom - Windows Setup Script (PowerShell)
# Run this script with: .\setup-windows.ps1

Write-Host "==========================================="
Write-Host "IoT Smart Classroom - Windows Setup Script"
Write-Host "==========================================="
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js is installed: $nodeVersion"
} catch {
    Write-Host "❌ ERROR: Node.js is not installed!" -ForegroundColor Red
    Write-Host "Please download and install Node.js from: https://nodejs.org/"
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if npm is available
try {
    $npmVersion = npm --version
    Write-Host "✓ npm is installed: v$npmVersion"
} catch {
    Write-Host "❌ ERROR: npm is not available!" -ForegroundColor Red
    Write-Host "Please reinstall Node.js which includes npm."
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Install frontend dependencies
Write-Host "Installing frontend dependencies..."
if (!(Test-Path "node_modules")) {
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ ERROR: Failed to install frontend dependencies!" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
} else {
    Write-Host "✓ Frontend dependencies already installed"
}

Write-Host ""

# Install backend dependencies
Write-Host "Installing backend dependencies..."
Set-Location backend
if (!(Test-Path "node_modules")) {
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ ERROR: Failed to install backend dependencies!" -ForegroundColor Red
        Set-Location ..
        Read-Host "Press Enter to exit"
        exit 1
    }
} else {
    Write-Host "✓ Backend dependencies already installed"
}
Set-Location ..

Write-Host ""

# Create .env files if they don't exist
if (!(Test-Path ".env")) {
    Write-Host "Creating .env file..."
    @"
VITE_API_BASE_URL=http://172.16.3.171:3001/api
VITE_WEBSOCKET_URL=http://172.16.3.171:3001
VITE_API_BASE_URL_EXTRA=http://192.168.0.108:3001/api
VITE_WEBSOCKET_URL_EXTRA=http://192.168.0.108:3001
VITE_API_BASE_URL_LOCAL=http://localhost:3001/api
VITE_WEBSOCKET_URL_LOCAL=http://localhost:3001
"@ | Out-File -FilePath ".env" -Encoding UTF8
    Write-Host "✓ Created .env file"
} else {
    Write-Host "✓ .env file already exists"
}

if (!(Test-Path "backend\.env")) {
    Write-Host "Creating backend/.env file..."
    @"
NODE_ENV=development
PORT=3001
HOST=172.16.3.171
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USERNAME=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password
EMAIL_FROM=your-email@gmail.com

# Security Settings
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100
API_RATE_LIMIT_WINDOW=15
API_RATE_LIMIT_MAX_REQUESTS=50
"@ | Out-File -FilePath "backend\.env" -Encoding UTF8
    Write-Host "✓ Created backend/.env file"
} else {
    Write-Host "✓ backend/.env file already exists"
}

Write-Host ""
Write-Host "==========================================="
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "==========================================="
Write-Host ""
Write-Host "IMPORTANT: Before running the application:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Update backend/.env with your MongoDB connection string"
Write-Host "2. Update backend/.env with your JWT secret"
Write-Host "3. If your IP address is different from 172.16.3.171, update:"
Write-Host "   - .env (VITE_API_BASE_URL and VITE_WEBSOCKET_URL)"
Write-Host "   - backend/.env (HOST)"
Write-Host "   - backend/server.js (CORS origins)"
Write-Host ""
Write-Host "To start the application:" -ForegroundColor Cyan
Write-Host ""
Write-Host "Terminal 1 - Backend:"
Write-Host "  cd backend"
Write-Host "  npm start"
Write-Host ""
Write-Host "Terminal 2 - Frontend:"
Write-Host "  npm run dev"
Write-Host ""
Write-Host "Then open: http://172.16.3.171:5173" -ForegroundColor Green
Write-Host ""
Write-Host "For network access from other devices:"
Write-Host "  http://172.16.3.171:5173" -ForegroundColor Green
Write-Host ""

Read-Host "Press Enter to exit"

Read-Host "Press Enter to exit"
