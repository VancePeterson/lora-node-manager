#include <Arduino.h>
#include <ArduinoJson.h>
#include "config.h"

uint8_t sequenceNumber = 0;
unsigned long lastTelemetry = 0;
String inputBuffer = "";

// =============================================================================
// CUSTOMIZE THIS SECTION FOR YOUR NODE
// =============================================================================

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

void handleCommand(const String& command) {
    Serial.print("CMD: ");
    Serial.println(command);

    JsonDocument response;
    response["ack"] = command;
    response["seq"] = sequenceNumber++;

    if (command == "PING") {
        response["result"] = "PONG";
    } else if (command == "STATUS") {
        response["uptime"] = millis() / 1000;
        response["address"] = LORA_ADDRESS;
        response["heap"] = ESP.getFreeHeap();
    } else if (command == "REBOOT") {
        response["result"] = "rebooting";
        String payload;
        serializeJson(response, payload);
        sendLoRa(GATEWAY_ADDRESS, payload);
        delay(100);
        ESP.restart();
        return;
    } else {
        // TODO: Add your custom commands here
        // Example:
        // if (command == "ON") { digitalWrite(RELAY_PIN, HIGH); }
        response["error"] = "unknown command";
    }

    String payload;
    serializeJson(response, payload);
    sendLoRa(GATEWAY_ADDRESS, payload);
}

void setupNode() {
    // TODO: Initialize your sensors/actuators here
    // Examples:
    // pinMode(RELAY_PIN, OUTPUT);
    // dht.begin();
    // Wire.begin();
}

// =============================================================================
// LORA COMMUNICATION (no changes needed below)
// =============================================================================

void sendLoRa(int destAddress, const String& data) {
    String command = "AT+SEND=" + String(destAddress) + "," +
                     String(data.length()) + "," + data;
    LORA_SERIAL.println(command);
    Serial.print("TX: ");
    Serial.println(data);
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

void setup() {
    Serial.begin(115200);
    Serial.println("\n\nLoRa Node Starting...");
    Serial.print("Address: ");
    Serial.println(LORA_ADDRESS);

    LORA_SERIAL.begin(LORA_BAUD, SERIAL_8N1, LORA_RX_PIN, LORA_TX_PIN);

    // Configure RYLR998 address
    String setAddr = "AT+ADDRESS=" + String(LORA_ADDRESS);
    LORA_SERIAL.println(setAddr);
    delay(100);

    setupNode();

    // Send initial telemetry after boot
    delay(1000);
    sendTelemetry();
}

void loop() {
    processLoRaSerial();

    if (millis() - lastTelemetry >= TELEMETRY_INTERVAL_MS) {
        lastTelemetry = millis();
        sendTelemetry();
    }
}
