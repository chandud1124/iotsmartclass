#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// ---------------- WiFi ----------------
#define WIFI_SSID "I am Not A Witch I am Your Wifi"
#define WIFI_PASSWORD "Whoareu@0000"

// ---------------- WebSocket ----------------
#define WEBSOCKET_HOST "172.16.3.56" // Local development server
#define WEBSOCKET_PORT 3001          // Backend server port
// Raw WebSocket endpoint path (matches backend server.js)
#define WEBSOCKET_PATH "/esp32-ws"
// Device authentication
#define DEVICE_SECRET_KEY "6af44c010af8ba58514c6fa989c6e6d3469068f2d8da19a4"

// ---------------- Pins ----------------
#define LED_PIN 2 // Built-in LED on most ESP32 dev boards
#define MAX_SWITCHES 8

// Relay logic (Most ESP32 relay boards are ACTIVE LOW)
#ifndef RELAY_ACTIVE_LOW
#define RELAY_ACTIVE_LOW 1
#endif
#if RELAY_ACTIVE_LOW
#define RELAY_ON_LEVEL LOW
#define RELAY_OFF_LEVEL HIGH
#else
#define RELAY_ON_LEVEL HIGH
#define RELAY_OFF_LEVEL LOW
#endif

// ---------------- Timers ----------------
#define WIFI_RETRY_INTERVAL_MS 3000
#define HEARTBEAT_INTERVAL_MS 15000
#define DEBOUNCE_MS 80
#define USE_SECURE_WS 1

// ---------------- Default switch map (factory) ----------------
struct SwitchConfig
{
  int relayPin;
  int manualPin;
  String name;
  bool manualActiveLow; // true if LOW = ON (closed)
};

// Only declare it here
extern const SwitchConfig defaultSwitchConfigs[MAX_SWITCHES];
// #include "config.h"

// Define the default switches here (only once!)
const SwitchConfig defaultSwitchConfigs[MAX_SWITCHES] = {
    {4, 25, "Fan1", true},
    {16, 27, "Fan2", true},
    {17, 32, "Light1", true},
    {5, 33, "Light2", true},
    {19, 12, "Projector", true},
    {18, 14, "NComputing", true},
    {21, 13, "AC Unit", true},
    {22, 15, "Printer", true}};
#endif // CONFIG_H