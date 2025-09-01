#!/bin/bash
# IoT Smart Classroom - IP Configuration Script
# This script helps configure the application for different IP addresses

echo "==========================================="
echo "IoT Smart Classroom - IP Configuration"
echo "==========================================="
echo

# Get current IP address
echo "Detecting your IP address..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    CURRENT_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    CURRENT_IP=$(hostname -I | awk '{print $1}')
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # Windows (Git Bash)
    CURRENT_IP=$(ipconfig | grep "IPv4 Address" | head -1 | awk '{print $NF}' | tr -d '\r')
else
    echo "Unsupported OS: $OSTYPE"
    exit 1
fi

echo "Your current IP address: $CURRENT_IP"
echo

# Ask user for target IP
read -p "Enter the IP address to configure (press Enter to use $CURRENT_IP): " TARGET_IP
TARGET_IP=${TARGET_IP:-$CURRENT_IP}

echo "Configuring application for IP: $TARGET_IP"
echo

# Update frontend .env
echo "Updating frontend configuration..."
sed -i.bak "s|http://[^:]*:3001|$TARGET_IP:3001|g" .env
echo "✓ Updated .env"

# Update backend .env
echo "Updating backend configuration..."
sed -i.bak "s|HOST=.*|HOST=$TARGET_IP|g" backend/.env
echo "✓ Updated backend/.env"

# Update CORS configuration in server.js
echo "Updating CORS configuration..."
sed -i.bak "s|http://[^:]*:5173|http://$TARGET_IP:5173|g" backend/server.js
sed -i.bak "s|http://[^:]*:5174|http://$TARGET_IP:5174|g" backend/server.js
sed -i.bak "s|http://[^:]*:5175|http://$TARGET_IP:5175|g" backend/server.js
echo "✓ Updated backend/server.js"

echo
echo "==========================================="
echo "Configuration Complete!" -ForegroundColor Green
echo "==========================================="
echo
echo "Application configured for IP: $TARGET_IP"
echo
echo "To start the application:"
echo
echo "Terminal 1 - Backend:"
echo "  cd backend && npm start"
echo
echo "Terminal 2 - Frontend:"
echo "  npm run dev"
echo
echo "Access URLs:"
echo "  Frontend: http://$TARGET_IP:5173"
echo "  Backend API: http://$TARGET_IP:3001/api"
echo "  Health Check: http://$TARGET_IP:3001/api/health"
echo
echo "Backup files created with .bak extension"
