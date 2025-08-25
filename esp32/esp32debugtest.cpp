// -----------------------------------------------------------------------------
// Enhanced ESP32 <-> Backend WebSocket implementation with offline functionality
// Debug/Test Version: Robustness, Crash Dumps, Health Telemetry, NVS Rate-Limit
// -----------------------------------------------------------------------------
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <esp_task_wdt.h>
#include "config.h"

// Uncomment to disable HMAC signing for debugging
// #define DISABLE_HMAC 1
#ifndef DISABLE_HMAC
#include <mbedtls/md.h>
#endif

#define WIFI_SSID "AIMS-WIFI"
#define WIFI_PASSWORD "Aimswifi#2025"
#define BACKEND_HOST "172.16.3.56"
#define BACKEND_PORT 3001
#define WS_PATH "/esp32-ws"
#define HEARTBEAT_MS 30000UL
#define DEVICE_SECRET "9545c46f0f9f494a27412fce1f5b22095550c4e88d82868f"
#ifndef STATUS_LED_PIN
#define STATUS_LED_PIN 2
#endif
#define STATE_DEBOUNCE_MS 200
#define MANUAL_DEBOUNCE_MS 30
#define MAX_COMMAND_QUEUE 16
#define COMMAND_PROCESS_INTERVAL 100
#define WIFI_RETRY_INTERVAL_MS 30000UL
#define IDENTIFY_RETRY_MS 10000UL
#define WDT_TIMEOUT_MS 12000 // 12s gives more headroom for NVS/network
#define RELAY_ON_LEVEL LOW
#define RELAY_OFF_LEVEL HIGH

// ========= Globals =========
Preferences prefs;
WebSocketsClient ws;
QueueHandle_t cmdQueue;

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

// NVS save rate-limiting
bool cfgDirty = false;
unsigned long lastCfgSave = 0;
const unsigned long CFG_SAVE_MIN_INTERVAL_MS = 5000; // 5s

// Health telemetry
unsigned long lastHealth = 0;
void logHealth(const char* tag) {
  size_t freeHeap = heap_caps_get_free_size(MALLOC_CAP_DEFAULT);
  UBaseType_t stackHi = uxTaskGetStackHighWaterMark(NULL);
  Serial.printf("[HEALTH] %s heap=%uB stackHWM=%u\n", tag, (unsigned)freeHeap, (unsigned)stackHi);
}

struct SwitchState {
  int gpio;
  bool state;
  String name;
  int manualGpio = -1;
  bool manualEnabled = false;
  bool manualActiveLow = true;
  bool manualMomentary = false;
  int lastManualLevel = -1;
  unsigned long lastManualChangeMs = 0;
  int stableManualLevel = -1;
  bool lastManualActive = false;
  bool defaultState = false;
  bool manualOverride = false;
};
struct Command {
  int gpio;
  bool state;
  bool valid;
  unsigned long timestamp;
};
struct GpioSeq { int gpio; long seq; };
std::vector<SwitchState> switchesLocal;
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
void maybeSaveConfig();

// -----------------------------------------------------------------------------
// Utility helpers
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// Load switch config from JSON array (from backend)
// -----------------------------------------------------------------------------
void loadConfigFromJsonArray(JsonArray arr) {
  switchesLocal.clear();
  for (JsonObject obj : arr) {
    SwitchState sw {};
    sw.gpio = obj["gpio"] | -1;
    if (sw.gpio < 0) continue;
    sw.state = obj["state"] | false;
    sw.defaultState = obj["default"] | false;
    sw.manualEnabled = obj["manual_en"] | false;
    sw.manualGpio = obj["manual_gpio"] | -1;
    sw.manualActiveLow = obj["active_low"] | true;
    sw.manualMomentary = obj["momentary"] | false;
    sw.name = obj["name"].is<const char*>() ? String(obj["name"].as<const char*>()) : String("Switch ") + String(sw.gpio);
    sw.manualOverride = obj["override"] | false;
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
  Serial.printf("[CONFIG] Loaded %d switches from JSON\n", (int)switchesLocal.size());
}
void sendJson(const JsonDocument &doc) {
  if (!ws.isConnected()) return;
  String out; serializeJson(doc, out);
  ws.sendTXT(out);
}
String hmacSha256(const String &key, const String &msg) {
#ifdef DISABLE_HMAC
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
  doc["secret"] = DEVICE_SECRET;
  doc["offline_capable"] = true;
  sendJson(doc);
  lastIdentifyAttempt = millis();
}
void sendStateUpdate(bool force) {
  unsigned long now = millis();
  if (!force && now - lastStateSent < STATE_DEBOUNCE_MS) { pendingState = true; return; }
  pendingState = false;
  lastStateSent = now;
  if (!ws.isConnected()) return;
  DynamicJsonDocument doc(512);
  doc["type"] = "state_update";
  doc["seq"] = (long)(millis());
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
long getLastSeq(int gpio){ for(auto &p: lastSeqs){ if(p.gpio==gpio) return p.seq; } return -1; }
void setLastSeq(int gpio, long seq){ for(auto &p: lastSeqs){ if(p.gpio==gpio){ p.seq=seq; return;} } lastSeqs.push_back({gpio,seq}); }
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
  int maxPerTick = 4; // drain faster but still paced
  while (maxPerTick-- && xQueueReceive(cmdQueue, &cmd, 0) == pdTRUE) {
    if (cmd.valid) applySwitchState(cmd.gpio, cmd.state);
  }
}
bool applySwitchState(int gpio, bool state) {
  for (auto &sw : switchesLocal) {
    if (sw.gpio == gpio) {
      sw.state = state;
      pinMode(sw.gpio, OUTPUT);
      digitalWrite(sw.gpio, state ? RELAY_ON_LEVEL : RELAY_OFF_LEVEL);
      Serial.printf("[SWITCH] GPIO %d -> %s\n", sw.gpio, state ? "ON":"OFF");
      sw.defaultState = state;
      cfgDirty = true; // mark for later
      sendStateUpdate(true);
      return true;
    }
  }
  Serial.printf("[SWITCH] Unknown GPIO %d (ignored)\n", gpio);
  return false;
}
void maybeSaveConfig() {
  if (!cfgDirty) return;
  if (millis() - lastCfgSave < CFG_SAVE_MIN_INTERVAL_MS) return;
  saveConfigToNVS();
  lastCfgSave = millis();
  cfgDirty = false;
}
void saveConfigToNVS() {
  prefs.begin("switchcfg", false);
  int numSwitches = min((int)switchesLocal.size(), MAX_SWITCHES);
  prefs.putInt("count", numSwitches);
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
  prefs.end();
  Serial.println("[NVS] Configuration saved");
}
void loadConfigFromNVS() {
  prefs.begin("switchcfg", true);
  int numSwitches = prefs.getInt("count", 0);
  if (numSwitches <= 0 || numSwitches > MAX_SWITCHES) {
    Serial.println("[NVS] No valid switch configuration found");
    prefs.end();
    return;
  }
  switchesLocal.clear();
  for (int i = 0; i < numSwitches; i++) {
    SwitchState sw {};
    sw.gpio = prefs.getInt(("gpio"+String(i)).c_str(), -1);
    if (sw.gpio < 0) continue;
    sw.state = prefs.getBool(("state"+String(i)).c_str(), false);
    sw.defaultState = prefs.getBool(("default"+String(i)).c_str(), false);
    sw.manualEnabled = prefs.getBool(("manual_en"+String(i)).c_str(), false);
    sw.manualGpio = prefs.getInt(("manual_gpio"+String(i)).c_str(), -1);
    sw.manualActiveLow = prefs.getBool(("active_low"+String(i)).c_str(), true);
    sw.manualMomentary = prefs.getBool(("momentary"+String(i)).c_str(), false);
    sw.name = prefs.getString(("name"+String(i)).c_str(), "Switch " + String(i+1));
    sw.manualOverride = prefs.getBool(("override"+String(i)).c_str(), false);
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
      sendStateUpdate(true);
      break;
    case WStype_TEXT: {
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
        lastSeqs.clear();
        if (doc["switches"].is<JsonArray>()) loadConfigFromJsonArray(doc["switches"].as<JsonArray>());
        else Serial.println(F("[CONFIG] No switches in identified payload (using none)"));
        return;
      }
      if (strcmp(msgType, "config_update") == 0) {
        if (doc["switches"].is<JsonArray>()) {
          Serial.println(F("[WS] <- config_update"));
          lastSeqs.clear();
          loadConfigFromJsonArray(doc["switches"].as<JsonArray>());
        }
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
        queueSwitchCommand(gpio, requested);
        return;
      }
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
      break;
    }
    case WStype_DISCONNECTED:
      Serial.println("WS disconnected");
      identified = false;
      isOfflineMode = true;
      connState = WIFI_ONLY;
      if (STATUS_LED_PIN != 255) digitalWrite(STATUS_LED_PIN, LOW);
      cfgDirty = true;
      maybeSaveConfig();
      break;
    default: break;
  }
}
void setupRelays() {
  switchesLocal.reserve(MAX_SWITCHES);
  lastSeqs.reserve(MAX_SWITCHES);
  loadConfigFromNVS();
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
void blinkStatus() {
  unsigned long now = millis();
  int pattern = 0;
  switch (connState) {
    case WIFI_DISCONNECTED:
      pattern = (now % 500) < 250;
      break;
    case WIFI_ONLY:
      pattern = (now % 1000) < 500;
      break;
    case BACKEND_CONNECTED:
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
    int rawLevel = digitalRead(sw.manualGpio);
    if (rawLevel != sw.lastManualLevel) {
      sw.lastManualLevel = rawLevel;
      sw.lastManualChangeMs = now;
    }
    if (rawLevel != sw.stableManualLevel && (now - sw.lastManualChangeMs >= MANUAL_DEBOUNCE_MS)) {
      sw.stableManualLevel = rawLevel;
      bool active = sw.manualActiveLow ? (rawLevel == LOW) : (rawLevel == HIGH);
      if (sw.manualMomentary) {
        if (active && !sw.lastManualActive) {
          queueSwitchCommand(sw.gpio, !sw.state);
          sw.manualOverride = true;
        }
      } else {
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
  cmdQueue = xQueueCreate(MAX_COMMAND_QUEUE, sizeof(Command));
  esp_task_wdt_config_t twdt_config = {
    .timeout_ms = WDT_TIMEOUT_MS,
    .idle_core_mask = (1 << portNUM_PROCESSORS) - 1,
    .trigger_panic = true // ENABLE Guru Meditation + backtrace
  };
  esp_task_wdt_init(&twdt_config);
  esp_task_wdt_add(NULL);
  isOfflineMode = true;
  connState = WIFI_DISCONNECTED;
  setupRelays();
  switchesLocal.reserve(MAX_SWITCHES);
  lastSeqs.reserve(MAX_SWITCHES);
  if (STATUS_LED_PIN != 255) {
    pinMode(STATUS_LED_PIN, OUTPUT);
    digitalWrite(STATUS_LED_PIN, LOW);
  }
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 10000) {
    delay(500);
    Serial.print(".");
    esp_task_wdt_reset();
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    connState = WIFI_ONLY;
    configTime(0, 0, "pool.ntp.org");
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
  esp_task_wdt_reset();
  if (WiFi.status() != WL_CONNECTED) {
    connState = WIFI_DISCONNECTED;
    isOfflineMode = true;
    unsigned long now = millis();
    if (now - lastWiFiRetry >= WIFI_RETRY_INTERVAL_MS) {
      lastWiFiRetry = now;
      wl_status_t wifiStatus = WiFi.status();
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
  ws.loop();
  processCommandQueue();
  handleManualSwitches();
  sendHeartbeat();
  blinkStatus();
  if (pendingState) {
    sendStateUpdate(true);
  }
  maybeSaveConfig();
  if (millis() - lastHealth > 10000) {
    logHealth("loop");
    lastHealth = millis();
  }
  delay(10);
}
