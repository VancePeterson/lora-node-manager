#include <Arduino.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include "config.h"

Preferences preferences;

// =============================================================================
// SETTINGS (persisted to flash)
// =============================================================================

struct NodeSettings {
    uint32_t telemetryIntervalMs;
    uint32_t heartbeatIntervalMs;
    bool deepSleepEnabled;
    uint32_t deepSleepDurationMs;
    uint8_t txPower;  // RYLR998 power level 0-22
};

NodeSettings settings;

void loadSettings() {
    preferences.begin("lora-node", true);  // read-only
    settings.telemetryIntervalMs = preferences.getULong("telemetryInt", TELEMETRY_INTERVAL_MS);
    settings.heartbeatIntervalMs = preferences.getULong("heartbeatInt", HEARTBEAT_INTERVAL_MS);
    settings.deepSleepEnabled = preferences.getBool("deepSleep", false);
    settings.deepSleepDurationMs = preferences.getULong("sleepDuration", 60000);
    settings.txPower = preferences.getUChar("txPower", 22);  // Max power default
    preferences.end();

    Serial.println("Settings loaded:");
    Serial.print("  Telemetry interval: ");
    Serial.println(settings.telemetryIntervalMs);
    Serial.print("  Heartbeat interval: ");
    Serial.println(settings.heartbeatIntervalMs);
    Serial.print("  Deep sleep: ");
    Serial.println(settings.deepSleepEnabled ? "enabled" : "disabled");
    Serial.print("  Sleep duration: ");
    Serial.println(settings.deepSleepDurationMs);
    Serial.print("  TX power: ");
    Serial.println(settings.txPower);
}

void saveSettings() {
    preferences.begin("lora-node", false);  // read-write
    preferences.putULong("telemetryInt", settings.telemetryIntervalMs);
    preferences.putULong("heartbeatInt", settings.heartbeatIntervalMs);
    preferences.putBool("deepSleep", settings.deepSleepEnabled);
    preferences.putULong("sleepDuration", settings.deepSleepDurationMs);
    preferences.putUChar("txPower", settings.txPower);
    preferences.end();
    Serial.println("Settings saved to flash");
}

void applyTxPower() {
    String cmd = "AT+CRFOP=" + String(settings.txPower);
    LORA_SERIAL.println(cmd);
    delay(100);
}

// =============================================================================
// LORA COMMUNICATION
// =============================================================================

uint8_t sequenceNumber = 0;
unsigned long lastTelemetry = 0;
String inputBuffer = "";

void sendLoRa(int destAddress, const String& data) {
    String command = "AT+SEND=" + String(destAddress) + "," +
                     String(data.length()) + "," + data;
    LORA_SERIAL.println(command);
    Serial.print("TX: ");
    Serial.println(data);
}

// =============================================================================
// NODE CONFIGURATION - Define what this node provides
// =============================================================================

void sendConfig() {
    JsonDocument doc;
    doc["type"] = "config";
    doc["address"] = LORA_ADDRESS;

    JsonArray fields = doc["fields"].to<JsonArray>();

    // TODO: Add your node's telemetry fields here
    // Each field needs: name, device_class (HA), unit
    //
    // Example for a temp/humidity sensor:
    // JsonObject temp = fields.add<JsonObject>();
    // temp["name"] = "temperature";
    // temp["class"] = "temperature";
    // temp["unit"] = "°C";
    //
    // JsonObject hum = fields.add<JsonObject>();
    // hum["name"] = "humidity";
    // hum["class"] = "humidity";
    // hum["unit"] = "%";

    String payload;
    serializeJson(doc, payload);
    sendLoRa(GATEWAY_ADDRESS, payload);
}

void sendSettings() {
    JsonDocument doc;
    doc["type"] = "settings";
    doc["address"] = LORA_ADDRESS;
    doc["telemetry_interval"] = settings.telemetryIntervalMs;
    doc["heartbeat_interval"] = settings.heartbeatIntervalMs;
    doc["deep_sleep"] = settings.deepSleepEnabled;
    doc["sleep_duration"] = settings.deepSleepDurationMs;
    doc["tx_power"] = settings.txPower;

    String payload;
    serializeJson(doc, payload);
    sendLoRa(GATEWAY_ADDRESS, payload);
}

void sendTelemetry() {
    JsonDocument doc;
    doc["seq"] = sequenceNumber++;

    // TODO: Add your sensor readings here
    // Examples:
    // doc["temperature"] = readTemperature();
    // doc["humidity"] = readHumidity();
    // doc["battery"] = analogRead(A0) * 3.3 / 4095.0;

    String payload;
    serializeJson(doc, payload);
    sendLoRa(GATEWAY_ADDRESS, payload);
}

// =============================================================================
// COMMAND HANDLING
// =============================================================================

void handleCommand(const String& command) {
    Serial.print("CMD: ");
    Serial.println(command);

    // Check if it's a JSON command
    if (command.startsWith("{")) {
        JsonDocument cmdDoc;
        DeserializationError err = deserializeJson(cmdDoc, command);
        if (err) {
            Serial.print("JSON parse error: ");
            Serial.println(err.c_str());
            return;
        }

        const char* cmd = cmdDoc["cmd"] | "";
        JsonDocument response;
        response["ack"] = cmd;

        // SET command - update settings
        if (strcmp(cmd, "SET") == 0) {
            bool changed = false;

            if (cmdDoc["telemetry_interval"].is<uint32_t>()) {
                settings.telemetryIntervalMs = cmdDoc["telemetry_interval"].as<uint32_t>();
                changed = true;
            }
            if (cmdDoc["heartbeat_interval"].is<uint32_t>()) {
                settings.heartbeatIntervalMs = cmdDoc["heartbeat_interval"].as<uint32_t>();
                changed = true;
            }
            if (cmdDoc["deep_sleep"].is<bool>()) {
                settings.deepSleepEnabled = cmdDoc["deep_sleep"].as<bool>();
                changed = true;
            }
            if (cmdDoc["sleep_duration"].is<uint32_t>()) {
                settings.deepSleepDurationMs = cmdDoc["sleep_duration"].as<uint32_t>();
                changed = true;
            }
            if (cmdDoc["tx_power"].is<uint8_t>()) {
                uint8_t newPower = cmdDoc["tx_power"].as<uint8_t>();
                if (newPower <= 22) {
                    settings.txPower = newPower;
                    applyTxPower();
                    changed = true;
                }
            }

            if (changed) {
                saveSettings();
                response["result"] = "ok";
                // Echo back current settings
                response["telemetry_interval"] = settings.telemetryIntervalMs;
                response["heartbeat_interval"] = settings.heartbeatIntervalMs;
                response["deep_sleep"] = settings.deepSleepEnabled;
                response["sleep_duration"] = settings.deepSleepDurationMs;
                response["tx_power"] = settings.txPower;
            } else {
                response["error"] = "no valid settings provided";
            }
        } else {
            response["error"] = "unknown json command";
        }

        String payload;
        serializeJson(response, payload);
        sendLoRa(GATEWAY_ADDRESS, payload);
        return;
    }

    // Plain text commands
    JsonDocument response;
    response["ack"] = command;
    response["seq"] = sequenceNumber++;

    if (command == "PING") {
        response["result"] = "PONG";
    } else if (command == "STATUS") {
        response["uptime"] = millis() / 1000;
        response["address"] = LORA_ADDRESS;
        response["heap"] = ESP.getFreeHeap();
        response["deep_sleep"] = settings.deepSleepEnabled;
    } else if (command == "CONFIG?") {
        sendConfig();
        return;
    } else if (command == "SETTINGS?") {
        sendSettings();
        return;
    } else if (command == "REBOOT") {
        response["result"] = "rebooting";
        String payload;
        serializeJson(response, payload);
        sendLoRa(GATEWAY_ADDRESS, payload);
        delay(100);
        ESP.restart();
        return;
    } else if (command == "SLEEP") {
        // Immediately enter deep sleep for configured duration
        response["result"] = "sleeping";
        response["duration"] = settings.deepSleepDurationMs;
        String payload;
        serializeJson(response, payload);
        sendLoRa(GATEWAY_ADDRESS, payload);
        delay(100);
        esp_deep_sleep(settings.deepSleepDurationMs * 1000ULL);  // microseconds
        return;
    } else if (command == "DEFAULTS") {
        // Reset to defaults
        settings.telemetryIntervalMs = TELEMETRY_INTERVAL_MS;
        settings.heartbeatIntervalMs = HEARTBEAT_INTERVAL_MS;
        settings.deepSleepEnabled = false;
        settings.deepSleepDurationMs = 60000;
        settings.txPower = 22;
        saveSettings();
        applyTxPower();
        response["result"] = "defaults restored";
    } else {
        // TODO: Add your custom commands here
        response["error"] = "unknown command";
    }

    String payload;
    serializeJson(response, payload);
    sendLoRa(GATEWAY_ADDRESS, payload);
}

void parseLoRaMessage(const String& message) {
    if (!message.startsWith("+RCV=")) return;

    String params = message.substring(5);
    int comma1 = params.indexOf(',');
    int comma2 = params.indexOf(',', comma1 + 1);
    int comma3 = params.indexOf(',', comma2 + 1);

    if (comma1 == -1 || comma2 == -1 || comma3 == -1) return;

    int fromAddress = params.substring(0, comma1).toInt();
    String data = params.substring(comma2 + 1, comma3);

    Serial.print("RX from ");
    Serial.print(fromAddress);
    Serial.print(": ");
    Serial.println(data);

    if (fromAddress == GATEWAY_ADDRESS) {
        handleCommand(data);
    }
}

void processLoRaSerial() {
    while (LORA_SERIAL.available()) {
        char c = LORA_SERIAL.read();
        if (c == '\n') {
            inputBuffer.trim();
            if (inputBuffer.length() > 0) {
                parseLoRaMessage(inputBuffer);
            }
            inputBuffer = "";
        } else if (c != '\r') {
            inputBuffer += c;
        }
    }
}

// =============================================================================
// SETUP & LOOP
// =============================================================================

void setupNode() {
    // TODO: Initialize your sensors/actuators here
    // Examples:
    // pinMode(RELAY_PIN, OUTPUT);
    // dht.begin();
    // Wire.begin();
}

void enterDeepSleep() {
    Serial.println("Entering deep sleep...");
    Serial.flush();
    esp_deep_sleep(settings.deepSleepDurationMs * 1000ULL);
}

void setup() {
    Serial.begin(115200);
    Serial.println("\n\nLoRa Node Starting...");
    Serial.print("Address: ");
    Serial.println(LORA_ADDRESS);

    // Load persisted settings
    loadSettings();

    // Initialize LoRa serial
    LORA_SERIAL.begin(LORA_BAUD, SERIAL_8N1, LORA_RX_PIN, LORA_TX_PIN);

    // Configure RYLR998 address and power
    delay(100);
    String setAddr = "AT+ADDRESS=" + String(LORA_ADDRESS);
    LORA_SERIAL.println(setAddr);
    delay(100);
    applyTxPower();

    setupNode();

    // Send initial telemetry after boot
    delay(1000);
    sendTelemetry();
}

void loop() {
    processLoRaSerial();

    unsigned long now = millis();

    // Send periodic telemetry
    if (now - lastTelemetry >= settings.telemetryIntervalMs) {
        lastTelemetry = now;
        sendTelemetry();

        // Enter deep sleep after telemetry if enabled
        if (settings.deepSleepEnabled) {
            enterDeepSleep();
        }
    }
}
