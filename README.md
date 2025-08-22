
# IoT Classroom Automation System

This project implements an ESP32-based classroom automation system with the following features:

- Control of multiple switches (fans, lights, projector, etc.)
- Manual switch control with debouncing
- WebSocket communication with backend server
- Offline operation when WiFi/backend is unavailable
- Scheduling capability
- Persistence of settings using NVS (Non-Volatile Storage)
- Watchdog timer to prevent crashes

## Project Structure

- `/esp32/` - ESP32 firmware code
  - `improved_esp32.cpp` - Main ESP32 code file (use this one)
  - `config.h` - Configuration settings
  - `main.cpp` - Legacy code (disabled)
  - `websocket_example.cpp` - Previous version (not used)

- `/backend/` - Backend server code
  - `server.js` - WebSocket server implementation
  - `/routes/esp32.js` - API routes for ESP32 devices
  - `/controllers/deviceApiController.js` - Device API controller

## Setup Instructions

1. Configure WiFi and WebSocket settings in `config.h`
2. Upload `improved_esp32.cpp` to your ESP32 device
3. Run the backend server with `node server.js`

## Notes

- The ESP32 will work offline after initial configuration
- Manual switches can override automatic control
- Schedules persist even during power loss
