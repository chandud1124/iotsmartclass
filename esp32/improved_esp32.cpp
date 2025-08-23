// -----------------------------------------------------------------------------
// Enhanced ESP32 <-> Backend WebSocket implementation with offline functionality
// Supports operation without WiFi/backend connection and prevents crashes
// Endpoint: ws://<HOST>:3001/esp32-ws  (server.js)
// -----------------------------------------------------------------------------
// Core messages:
//  -> identify      {type:'identify', mac, secret}
//  <- identified    {type:'identified', mode, switches:[{gpio,relayGpio,name,...}]}
//  <- config_update {type:'config_update', switches:[...]}  (after UI edits)
//  <- switch_command{type:'switch_command', gpio|relayGpio, state}
//  -> state_update  {type:'state_update', switches:[{gpio,state}]}
//  -> heartbeat     {type:'heartbeat', uptime}
//  <- state_ack     {type:'state_ack', changed}
// -----------------------------------------------------------------------------

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <esp_task_wdt.h>
#include "config.h"

// Uncomment to compile without mbedtls/HMAC (for older cores or minimal builds)
// #define DISABLE_HMAC 1
#ifndef DISABLE_HMAC
#include <mbedtls/md.h>
#endif

#define WIFI_SSID "AIMS-WIFI"
#define WIFI_PASSWORD "Aimswifi#2025"
#define BACKEND_HOST "172.16.3.56"  // backend LAN IP
#define BACKEND_PORT 3001
#define WS_PATH "/esp32-ws"
#define HEARTBEAT_MS 30000UL          // 30s heartbeat interval
#define DEVICE_SECRET "9545c46f0f9f494a27412fce1f5b22095550c4e88d82868f" // device secret from backend

// Optional status LED (set to 255 to disable if your board lacks LED_BUILTIN)
#ifndef STATUS_LED_PIN
#define STATUS_LED_PIN 2
#endif

// Debounce multiple rapid local state changes into one state_update
#define STATE_DEBOUNCE_MS 200
#define MANUAL_DEBOUNCE_MS 30

// Command queue size and processing interval
#define MAX_COMMAND_QUEUE 16
#define COMMAND_PROCESS_INTERVAL 100  // Process commands every 100ms

// WiFi reconnection constants
#define WIFI_RETRY_INTERVAL_MS 30000UL
#define IDENTIFY_RETRY_MS 10000UL

// Watchdog timeout (10 seconds)
#define WDT_TIMEOUT_MS 10000

// Active-low mapping: logical ON -> LOW, OFF -> HIGH (common relay boards)
#define RELAY_ON_LEVEL LOW
#define RELAY_OFF_LEVEL HIGH

// ========= Globals =========
Preferences prefs;
WebSocketsClient ws;
QueueHandle_t cmdQueue;

// Connection / timers
enum ConnState { WIFI_DISCONNECTED, WIFI_ONLY, BACKEND_CONNECTED };
ConnState connState = WIFI_DISCONNECTED;
unsigned long lastHeartbeat = 0;
unsigned long lastStateSent = 0;
unsigned long lastCommandProcess = 0;
unsigned long lastWiFiRetry = 0;
unsigned long lastIdentifyAttempt = 0;
bool pendingState = false;
bool identified = false;
bool isOfflineMode = true;
int reconnectionAttempts = 0;

// Extended switch state supports optional manual (wall) switch input GPIO

struct SwitchState {
  int gpio;                    // relay control GPIO (output)
  bool state;                  // logical ON/OFF state
  String name;                 // label from backend
  int manualGpio = -1;         // optional manual switch GPIO (input)
  bool manualEnabled = false;  // whether manual input is active
  bool manualActiveLow = true; // per-switch input polarity (independent of relay polarity)
  bool manualMomentary = false; // true = momentary (toggle on active edge), false = maintained (level maps to state)
  int lastManualLevel = -1;    // last raw digitalRead level
  unsigned long lastManualChangeMs = 0; // last time raw level flipped
  int stableManualLevel = -1;  // debounced level
  bool lastManualActive = false; // previous debounced logical active level (after polarity)
  bool defaultState = false;   // default state for offline mode
  bool manualOverride = false; // whether this switch was manually overridden
};

// Command queue to prevent crashes from multiple simultaneous commands
struct Command {
  int gpio;
  bool state;
  bool valid;
  unsigned long timestamp;
};

// Track last applied sequence per GPIO to drop stale commands
struct GpioSeq { int gpio; long seq; };

std::vector<SwitchState> switchesLocal; // dynamically populated
std::vector<GpioSeq> lastSeqs;

// Forward declarations
void sendJson(const JsonDocument &doc);
String hmacSha256(const String &key, const String &msg);
void identify();
void sendStateUpdate(bool force);
void sendHeartbeat();
long getLastSeq(int gpio);
void setLastSeq(int gpio, long seq);
bool applySwitchState(int gpio, bool state);
void loadConfigFromJsonArray(JsonArray arr);
void saveConfigToNVS();
void loadConfigFromNVS();
void onWsEvent(WStype_t type, uint8_t * payload, size_t length);
void setupRelays();
void processCommandQueue();
void blinkStatus();
void handleManualSwitches();

// -----------------------------------------------------------------------------
// Utility helpers
// -----------------------------------------------------------------------------
void sendJson(const JsonDocument &doc) {
  if (!ws.isConnected()) return;
  
  String out; serializeJson(doc, out);
  ws.sendTXT(out);
}

String hmacSha256(const String &key, const String &msg) {
#ifdef DISABLE_HMAC
  // HMAC disabled: return empty string to skip signing
  (void)key; (void)msg; return String("");
#else
  byte hmacResult[32];
  mbedtls_md_context_t ctx;
  const mbedtls_md_info_t *info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, info, 1);
  mbedtls_md_hmac_starts(&ctx, (const unsigned char*)key.c_str(), key.length());
  mbedtls_md_hmac_update(&ctx, (const unsigned char*)msg.c_str(), msg.length());
  mbedtls_md_hmac_finish(&ctx, hmacResult);
  mbedtls_md_free(&ctx);
  char buf[65];
  for (int i=0;i<32;i++) sprintf(&buf[i*2], "%02x", hmacResult[i]);
  buf[64]='\0';
  return String(buf);
#endif
}

void identify() {
  DynamicJsonDocument doc(256);
  doc["type"] = "identify";
  doc["mac"] = WiFi.macAddress();
  doc["secret"] = DEVICE_SECRET; // simple shared secret (upgrade to HMAC if needed)
  doc["offline_capable"] = true;  // Indicate this device supports offline mode
  sendJson(doc);
  lastIdentifyAttempt = millis();
}

void sendStateUpdate(bool force) {
  unsigned long now = millis();
  if (!force && now - lastStateSent < STATE_DEBOUNCE_MS) { pendingState = true; return; }
  pendingState = false;
  lastStateSent = now;
  
  // Don't try to send if not connected
  if (!ws.isConnected()) return;
  
  DynamicJsonDocument doc(512);
  doc["type"] = "state_update";
  doc["seq"] = (long)(millis()); // coarse monotonic seq for state_update
  doc["ts"] = (long)(millis());
  JsonArray arr = doc.createNestedArray("switches");
  for (auto &sw : switchesLocal) {
    JsonObject o = arr.createNestedObject();
    o["gpio"] = sw.gpio;
    o["state"] = sw.state;
    o["manual_override"] = sw.manualOverride;
  }
  if (strlen(DEVICE_SECRET) > 0) {
    String base = WiFi.macAddress();
    base += "|"; base += (long)doc["seq"]; base += "|"; base += (long)doc["ts"];
    doc["sig"] = hmacSha256(DEVICE_SECRET, base);
  }
  sendJson(doc);
  Serial.println(F("[WS] -> state_update"));
}

void sendHeartbeat() {
  unsigned long now = millis();
  if (now - lastHeartbeat < HEARTBEAT_MS) return;
  lastHeartbeat = now;
  
  if (ws.isConnected()) {
    DynamicJsonDocument doc(256);
    doc["type"] = "heartbeat";
    doc["mac"] = WiFi.macAddress();
    doc["uptime"] = millis()/1000;
    doc["offline_mode"] = isOfflineMode;
    sendJson(doc);
    Serial.println("[WS] -> heartbeat");
  }
}

long getLastSeq(int gpio){ 
  for(auto &p: lastSeqs){ 
    if(p.gpio==gpio) return p.seq; 
  } 
  return -1; 
}

void setLastSeq(int gpio, long seq){ 
  for(auto &p: lastSeqs){ 
    if(p.gpio==gpio){ 
      p.seq=seq; 
      return;
    } 
  } 
  lastSeqs.push_back({gpio,seq}); 
}

void queueSwitchCommand(int gpio, bool state) {
  Command cmd;
  cmd.gpio = gpio;
  cmd.state = state;
  cmd.valid = true;
  cmd.timestamp = millis();
  
  if (xQueueSend(cmdQueue, &cmd, 0) != pdTRUE) {
    Serial.println("[CMD] Command queue full, dropping command");
  } else {
    Serial.printf("[CMD] Queued command: GPIO %d -> %s\n", gpio, state ? "ON" : "OFF");
  }
}

void processCommandQueue() {
  unsigned long now = millis();
  if (now - lastCommandProcess < COMMAND_PROCESS_INTERVAL) return;
  lastCommandProcess = now;
  
  Command cmd;
  if (xQueueReceive(cmdQueue, &cmd, 0) == pdTRUE) {
    if (cmd.valid) {
      applySwitchState(cmd.gpio, cmd.state);
    }
  }
}

bool applySwitchState(int gpio, bool state) {
  for (auto &sw : switchesLocal) {
    if (sw.gpio == gpio) {
      sw.state = state;
      pinMode(sw.gpio, OUTPUT);
      digitalWrite(sw.gpio, state ? RELAY_ON_LEVEL : RELAY_OFF_LEVEL);
      Serial.printf("[SWITCH] GPIO %d -> %s\n", sw.gpio, state ? "ON":"OFF");
      
      // Save state to NVS for offline persistence
      sw.defaultState = state;
      saveConfigToNVS();
      
      sendStateUpdate(true); // immediate broadcast
      return true;
    }
  }
  Serial.printf("[SWITCH] Unknown GPIO %d (ignored)\n", gpio);
  return false;
}

void loadConfigFromJsonArray(JsonArray arr) {
  switchesLocal.clear();
  for (JsonObject o : arr) {
    int g = o["relayGpio"].is<int>() ? o["relayGpio"].as<int>() : (o["gpio"].is<int>() ? o["gpio"].as<int>() : -1);
    if (g < 0) continue;
    bool desiredState = o["state"].is<bool>() ? o["state"].as<bool>() : false; // default OFF logically
    SwitchState sw { };
    sw.gpio = g;
    sw.state = desiredState;
    sw.defaultState = desiredState;  // Store default state for offline mode
    sw.name = String(o["name"].is<const char*>() ? o["name"].as<const char*>() : "");
    sw.manualOverride = false;
    
    // Manual switch config (optional)
    if (o["manualSwitchEnabled"].is<bool>() && o["manualSwitchEnabled"].as<bool>() && o["manualSwitchGpio"].is<int>()) {
      sw.manualEnabled = true;
      sw.manualGpio = o["manualSwitchGpio"].as<int>();
      // Parse manualMode (maintained | momentary) and polarity
      if (o["manualMode"].is<const char*>()) {
        const char *mm = o["manualMode"].as<const char*>();
        sw.manualMomentary = (strcmp(mm, "momentary") == 0);
      }
      if (o["manualActiveLow"].is<bool>()) {
        sw.manualActiveLow = o["manualActiveLow"].as<bool>();
      }
    }
    pinMode(g, OUTPUT);
    digitalWrite(g, desiredState ? RELAY_ON_LEVEL : RELAY_OFF_LEVEL);
    if (sw.manualEnabled && sw.manualGpio >= 0) {
      // Configure input with proper pull depending on polarity.
      // NOTE: GPIOs 34-39 are input-only and DO NOT support internal pull-up/down.
      // For those pins, we set INPUT and require an external resistor.
      if (sw.manualGpio >= 34 && sw.manualGpio <= 39) {
        pinMode(sw.manualGpio, INPUT);
        Serial.printf("[MANUAL][WARN] gpio=%d is input-only (34-39) without internal pull resistors. Use external pull-%s.\n",
                      sw.manualGpio, sw.manualActiveLow ? "up to 3.3V" : "down to GND");
      } else {
        if (sw.manualActiveLow) {
          pinMode(sw.manualGpio, INPUT_PULLUP); // active when pulled LOW (to GND)
        } else {
          // Many ESP32 pins support internal pulldown; if not available, add external pulldown
          pinMode(sw.manualGpio, INPUT_PULLDOWN);
        }
      }
      sw.lastManualLevel = digitalRead(sw.manualGpio);
      sw.stableManualLevel = sw.lastManualLevel;
      // Initialize active logical level after polarity mapping
      sw.lastManualActive = sw.manualActiveLow ? (sw.stableManualLevel == LOW) : (sw.stableManualLevel == HIGH);
      Serial.printf("[MANUAL][INIT] gpio=%d (input %d) activeLow=%d mode=%s raw=%d active=%d\n",
                    sw.gpio, sw.manualGpio, sw.manualActiveLow ? 1 : 0,
                    sw.manualMomentary ? "momentary" : "maintained",
                    sw.stableManualLevel, sw.lastManualActive ? 1 : 0);
    }
    switchesLocal.push_back(sw);
  }
  Serial.printf("[CONFIG] Loaded %u switches\n", (unsigned)switchesLocal.size());
  // Snapshot print for verification
  for (auto &sw : switchesLocal) {
    Serial.printf("[SNAPSHOT] gpio=%d state=%s manual=%s manualGpio=%d mode=%s activeLow=%d\n",
                  sw.gpio, sw.state?"ON":"OFF", sw.manualEnabled?"yes":"no", sw.manualGpio,
                  sw.manualMomentary?"momentary":"maintained", sw.manualActiveLow?1:0);
  }
  
  // Save configuration to NVS for offline persistence
  saveConfigToNVS();
  
  sendStateUpdate(true);
}

// Save configuration to NVS for offline persistence
void saveConfigToNVS() {
  prefs.begin("switchcfg", false);
  
  // Save number of switches
  int numSwitches = min((int)switchesLocal.size(), MAX_SWITCHES);
  prefs.putInt("count", numSwitches);
  
  // Save switch configurations
  for (int i = 0; i < numSwitches; i++) {
    prefs.putInt(("gpio"+String(i)).c_str(), switchesLocal[i].gpio);
    prefs.putBool(("state"+String(i)).c_str(), switchesLocal[i].state);
    prefs.putBool(("default"+String(i)).c_str(), switchesLocal[i].defaultState);
    prefs.putBool(("manual_en"+String(i)).c_str(), switchesLocal[i].manualEnabled);
    prefs.putInt(("manual_gpio"+String(i)).c_str(), switchesLocal[i].manualGpio);
    prefs.putBool(("active_low"+String(i)).c_str(), switchesLocal[i].manualActiveLow);
    prefs.putBool(("momentary"+String(i)).c_str(), switchesLocal[i].manualMomentary);
    prefs.putString(("name"+String(i)).c_str(), switchesLocal[i].name);
    prefs.putBool(("override"+String(i)).c_str(), switchesLocal[i].manualOverride);
  }
  
  // ...existing code...
  
  prefs.end();
  
  Serial.println("[NVS] Configuration saved");
}

// Load configuration from NVS for offline persistence
void loadConfigFromNVS() {
  prefs.begin("switchcfg", true);
  
  // Check if we have valid data
  int numSwitches = prefs.getInt("count", 0);
  if (numSwitches <= 0 || numSwitches > MAX_SWITCHES) {
    Serial.println("[NVS] No valid switch configuration found");
    prefs.end();
    return;
  }
  
  // Load switch configurations
  switchesLocal.clear();
  for (int i = 0; i < numSwitches; i++) {
    SwitchState sw { };
    sw.gpio = prefs.getInt(("gpio"+String(i)).c_str(), -1);
    if (sw.gpio < 0) continue; // Skip invalid GPIOs
    
    sw.state = prefs.getBool(("state"+String(i)).c_str(), false);
    sw.defaultState = prefs.getBool(("default"+String(i)).c_str(), false);
    sw.manualEnabled = prefs.getBool(("manual_en"+String(i)).c_str(), false);
    sw.manualGpio = prefs.getInt(("manual_gpio"+String(i)).c_str(), -1);
    sw.manualActiveLow = prefs.getBool(("active_low"+String(i)).c_str(), true);
    sw.manualMomentary = prefs.getBool(("momentary"+String(i)).c_str(), false);
    sw.name = prefs.getString(("name"+String(i)).c_str(), "Switch " + String(i+1));
    sw.manualOverride = prefs.getBool(("override"+String(i)).c_str(), false);
    
    // Initialize pins
    pinMode(sw.gpio, OUTPUT);
    digitalWrite(sw.gpio, sw.state ? RELAY_ON_LEVEL : RELAY_OFF_LEVEL);
    
    if (sw.manualEnabled && sw.manualGpio >= 0) {
      if (sw.manualGpio >= 34 && sw.manualGpio <= 39) {
        pinMode(sw.manualGpio, INPUT);
      } else {
        if (sw.manualActiveLow) {
          pinMode(sw.manualGpio, INPUT_PULLUP);
        } else {
          pinMode(sw.manualGpio, INPUT_PULLDOWN);
        }
      }
      sw.lastManualLevel = digitalRead(sw.manualGpio);
      sw.stableManualLevel = sw.lastManualLevel;
      sw.lastManualActive = sw.manualActiveLow ? (sw.stableManualLevel == LOW) : (sw.stableManualLevel == HIGH);
    }
    
    switchesLocal.push_back(sw);
  }
  
  // ...existing code...
  
  prefs.end();
  
  Serial.printf("[NVS] Loaded %d switches\n", (int)switchesLocal.size());
}

void onWsEvent(WStype_t type, uint8_t * payload, size_t len) {
  switch (type) {
    case WStype_CONNECTED:
      Serial.println("WS connected");
      identified = false;
      isOfflineMode = false;
      connState = BACKEND_CONNECTED;
      if (STATUS_LED_PIN != 255) digitalWrite(STATUS_LED_PIN, HIGH);
      identify();
      // Send latest manual switch states to backend/UI immediately upon reconnect
      sendStateUpdate(true);
      break;
    case WStype_TEXT: {
      // Use try-catch to prevent crashes from malformed JSON
      try {
        DynamicJsonDocument doc(1024);
        if (deserializeJson(doc, payload, len) != DeserializationError::Ok) {
          Serial.println(F("[WS] JSON parse error"));
          return;
        }
        const char* msgType = doc["type"] | "";
        if (strcmp(msgType, "identified") == 0) {
          identified = true;
          isOfflineMode = false;
          if (STATUS_LED_PIN != 255) digitalWrite(STATUS_LED_PIN, HIGH);
          const char* _mode = doc["mode"].is<const char*>() ? doc["mode"].as<const char*>() : "n/a";
          Serial.printf("[WS] <- identified mode=%s\n", _mode);
          // Reset per-GPIO sequence tracking on fresh identify to avoid stale_seq after server restarts
          lastSeqs.clear();
          if (doc["switches"].is<JsonArray>()) loadConfigFromJsonArray(doc["switches"].as<JsonArray>());
          else Serial.println(F("[CONFIG] No switches in identified payload (using none)"));
          
          // ...existing code...
          return;
        }
        if (strcmp(msgType, "config_update") == 0) {
          if (doc["switches"].is<JsonArray>()) {
            Serial.println(F("[WS] <- config_update"));
            // Clear seq tracking as mapping may change
            lastSeqs.clear();
            loadConfigFromJsonArray(doc["switches"].as<JsonArray>());
          }
          
          // ...existing code...
          return;
        }
        if (strcmp(msgType, "state_ack") == 0) {
          bool changed = doc["changed"] | false;
          Serial.printf("[WS] <- state_ack changed=%s\n", changed ? "true":"false");
          return;
        }
        if (strcmp(msgType, "switch_command") == 0) {
          int gpio = doc["relayGpio"].is<int>() ? doc["relayGpio"].as<int>() : (doc["gpio"].is<int>() ? doc["gpio"].as<int>() : -1);
          bool requested = doc["state"] | false;
          long seq = doc["seq"].is<long>() ? doc["seq"].as<long>() : -1;
          Serial.printf("[CMD] Raw: %.*s\n", (int)len, payload);
          Serial.printf("[CMD] switch_command gpio=%d state=%s seq=%ld\n", gpio, requested ? "ON":"OFF", seq);
          
          // Queue the command instead of executing immediately
          queueSwitchCommand(gpio, requested);
          return;
        }
                // Bulk switch command support
        if (strcmp(msgType, "bulk_switch_command") == 0) {
          Serial.printf("[CMD] bulk_switch_command received\n");
          if (doc["commands"].is<JsonArray>()) {
            JsonArray cmds = doc["commands"].as<JsonArray>();
            int processed = 0;
            for (JsonObject cmd : cmds) {
              int gpio = cmd["relayGpio"].is<int>() ? cmd["relayGpio"].as<int>() : (cmd["gpio"].is<int>() ? cmd["gpio"].as<int>() : -1);
              bool requested = cmd["state"].is<bool>() ? cmd["state"].as<bool>() : false;
              long seq = cmd["seq"].is<long>() ? cmd["seq"].as<long>() : -1;
              if (gpio >= 0) {
                queueSwitchCommand(gpio, requested);
                processed++;
              } else {
                Serial.printf("[CMD] bulk: invalid gpio in command\n");
              }
            }
            Serial.printf("[CMD] bulk_switch_command processed %d commands\n", processed);
            DynamicJsonDocument res(256);
            res["type"] = "bulk_switch_result";
            res["processed"] = processed;
            res["total"] = cmds.size();
            sendJson(res);
          } else {
            Serial.printf("[CMD] bulk_switch_command missing 'commands' array\n");
          }
          return;
        }
        Serial.printf("[WS] <- unhandled type=%s Raw=%.*s\n", msgType, (int)len, payload);
      } catch (const std::exception& e) {
        Serial.print("Exception in WebSocket handler: ");
        Serial.println(e.what());
      }
      break; 
    }
    case WStype_DISCONNECTED:
      Serial.println("WS disconnected");
      identified = false;
      isOfflineMode = true;
      connState = WIFI_ONLY;
      if (STATUS_LED_PIN != 255) digitalWrite(STATUS_LED_PIN, LOW);
      break;
    default: break;
  }
}

void setupRelays() {
  // First try to load from NVS
  loadConfigFromNVS();
  // If no switches loaded, use defaults from config.h
  if (switchesLocal.empty()) {
    Serial.println("[SETUP] No saved config, using defaults from config.h");
    for (int i = 0; i < MAX_SWITCHES; i++) {
      SwitchState sw {};
      sw.gpio = defaultSwitchConfigs[i].relayPin;
      sw.state = false;
      sw.defaultState = false;
      sw.name = defaultSwitchConfigs[i].name;
      sw.manualOverride = false;
      sw.manualEnabled = true;
      sw.manualGpio = defaultSwitchConfigs[i].manualPin;
      sw.manualActiveLow = defaultSwitchConfigs[i].manualActiveLow;
      sw.manualMomentary = false;
      pinMode(sw.gpio, OUTPUT);
      digitalWrite(sw.gpio, RELAY_OFF_LEVEL);
      if (sw.manualGpio >= 34 && sw.manualGpio <= 39) {
        pinMode(sw.manualGpio, INPUT);
      } else {
        pinMode(sw.manualGpio, INPUT_PULLUP);
      }
      sw.lastManualLevel = digitalRead(sw.manualGpio);
      sw.stableManualLevel = sw.lastManualLevel;
      sw.lastManualActive = sw.manualActiveLow ? (sw.stableManualLevel == LOW) : (sw.stableManualLevel == HIGH);
      switchesLocal.push_back(sw);
    }
    saveConfigToNVS();
  } else {
    for (auto &sw : switchesLocal) {
      pinMode(sw.gpio, OUTPUT);
      digitalWrite(sw.gpio, sw.state ? RELAY_ON_LEVEL : RELAY_OFF_LEVEL);
    }
  }
}

// ...existing code...

void blinkStatus() {
  unsigned long now = millis();
  int pattern = 0;
  
  switch (connState) {
    case WIFI_DISCONNECTED:
      // Fast blink (250ms on, 250ms off)
      pattern = (now % 500) < 250;
      break;
    case WIFI_ONLY:
      // Medium blink (500ms on, 500ms off)
      pattern = (now % 1000) < 500;
      break;
    case BACKEND_CONNECTED:
      // Slow pulse (1s on, 1s off)
      pattern = (now % 2000) < 1000;
      break;
  }
  
  if (STATUS_LED_PIN != 255) {
    digitalWrite(STATUS_LED_PIN, pattern ? HIGH : LOW);
  }
}

void handleManualSwitches() {
  unsigned long now = millis();
  
  for (auto &sw : switchesLocal) {
    if (!sw.manualEnabled || sw.manualGpio < 0) continue;
    
    // Read current level
    int rawLevel = digitalRead(sw.manualGpio);
    
    // If level changed, start debounce
    if (rawLevel != sw.lastManualLevel) {
      sw.lastManualLevel = rawLevel;
      sw.lastManualChangeMs = now;
    }
    
    // Check if debounce period passed
    if (rawLevel != sw.stableManualLevel && (now - sw.lastManualChangeMs >= MANUAL_DEBOUNCE_MS)) {
      // Debounced change detected
      sw.stableManualLevel = rawLevel;
      bool active = sw.manualActiveLow ? (rawLevel == LOW) : (rawLevel == HIGH);
      
      if (sw.manualMomentary) {
        // For momentary switches, toggle on active edge
        if (active && !sw.lastManualActive) {
          // Toggle on active edge
          queueSwitchCommand(sw.gpio, !sw.state);
          sw.manualOverride = true;
        }
      } else {
        // For maintained switches, follow switch position
        if (active != sw.state) {
          queueSwitchCommand(sw.gpio, active);
          sw.manualOverride = true;
        }
      }
      
      sw.lastManualActive = active;
    }
  }
}

void setup() {
  Serial.begin(115200);
  Serial.println("\nESP32 Classroom Automation System Starting...");
  
  // Initialize command queue
  cmdQueue = xQueueCreate(MAX_COMMAND_QUEUE, sizeof(Command));
  
  // Setup watchdog timer
  esp_task_wdt_config_t twdt_config = { 
    .timeout_ms = WDT_TIMEOUT_MS, 
    .idle_core_mask = (1 << portNUM_PROCESSORS) - 1, 
    .trigger_panic = false // Changed from true to false for auto-restart
  };
  esp_task_wdt_init(&twdt_config);
  esp_task_wdt_add(NULL);  // Add current task (loopTask)
  
  // Start in offline mode
  isOfflineMode = true;
  connState = WIFI_DISCONNECTED;
  
  // Setup relays and load configuration from NVS if available
  setupRelays();
  
  if (STATUS_LED_PIN != 255) { 
    pinMode(STATUS_LED_PIN, OUTPUT); 
    digitalWrite(STATUS_LED_PIN, LOW); 
  }
  
  // Try to connect to WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  
  // Try to connect for 10 seconds, then continue in offline mode if unsuccessful
  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 10000) {
    delay(500);
    Serial.print(".");
    esp_task_wdt_reset(); // Reset watchdog during WiFi connection
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    connState = WIFI_ONLY;
    
    // Configure time
    configTime(0, 0, "pool.ntp.org");
    
    // Setup WebSocket connection
    ws.begin(BACKEND_HOST, BACKEND_PORT, WS_PATH);
    ws.onEvent(onWsEvent);
    ws.setReconnectInterval(5000);
    isOfflineMode = false;
  } else {
    Serial.println("\nWiFi connection failed, operating in offline mode");
    isOfflineMode = true;
  }
  
  lastHeartbeat = millis();
  lastCommandProcess = millis();
  lastWiFiRetry = millis();
  
  Serial.println("Setup complete!");
}

void loop() {
  // Reset watchdog timer
  esp_task_wdt_reset();
  
  // Handle WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    connState = WIFI_DISCONNECTED;
    isOfflineMode = true;
    unsigned long now = millis();
    if (now - lastWiFiRetry >= WIFI_RETRY_INTERVAL_MS) {
      lastWiFiRetry = now;
      // Only retry if not already connecting
      wl_status_t wifiStatus = WiFi.status();
  /* Arduino core does not define WL_CONNECTING, so always retry */
  if (true) {
        Serial.println("Retrying WiFi connection...");
        WiFi.disconnect();
        WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      } else {
        Serial.println("WiFi is already connecting, skipping WiFi.begin()");
      }
    }
  } else {
    if (!ws.isConnected()) {
      connState = WIFI_ONLY;
      isOfflineMode = true;
      unsigned long now = millis();
      if (identified == false && now - lastIdentifyAttempt >= IDENTIFY_RETRY_MS) {
        identify();
      }
    } else {
      connState = BACKEND_CONNECTED;
      isOfflineMode = false;
    }
  }
  
  // Process WebSocket events
  ws.loop();
  
  // Process command queue
  processCommandQueue();
  
  // Handle manual switches
  handleManualSwitches();
  
  // ...existing code...
  
  // Send heartbeat
  sendHeartbeat();
  
  // Update LED status
  blinkStatus();
  
  // Send pending state updates
  if (pendingState) {
    sendStateUpdate(true);
  }
  
  // Small delay to prevent CPU hogging
  delay(10);
}