#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "config.h"

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

String inputBuffer = "";

void setupWiFi() {
    Serial.print("Connecting to WiFi");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println(" connected!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
    // Parse topic: lora/{address}/debug
    String topicStr = String(topic);
    int firstSlash = topicStr.indexOf('/');
    int secondSlash = topicStr.indexOf('/', firstSlash + 1);

    if (secondSlash == -1) return;

    String addressStr = topicStr.substring(firstSlash + 1, secondSlash);
    String subtopic = topicStr.substring(secondSlash + 1);

    if (subtopic != "debug") return;

    int address = addressStr.toInt();
    String command = "";
    for (unsigned int i = 0; i < length; i++) {
        command += (char)payload[i];
    }

    // Send command via LoRa
    // AT+SEND=<address>,<length>,<data>
    String atCommand = "AT+SEND=" + String(address) + "," +
                       String(command.length()) + "," + command;
    LORA_SERIAL.println(atCommand);

    Serial.print("TX to ");
    Serial.print(address);
    Serial.print(": ");
    Serial.println(command);
}

void reconnectMQTT() {
    while (!mqtt.connected()) {
        Serial.print("Connecting to MQTT...");
        if (mqtt.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASSWORD)) {
            Serial.println(" connected!");

            // Subscribe to debug topics for all nodes
            String debugTopic = String(MQTT_TOPIC_PREFIX) + "/+/debug";
            mqtt.subscribe(debugTopic.c_str());
            Serial.print("Subscribed to: ");
            Serial.println(debugTopic);

            // Publish gateway status
            String statusTopic = String(MQTT_TOPIC_PREFIX) + "/gateway/state";
            JsonDocument doc;
            doc["ip"] = WiFi.localIP().toString();
            doc["uptime"] = millis() / 1000;

            String payload;
            serializeJson(doc, payload);
            mqtt.publish(statusTopic.c_str(), payload.c_str(), true);
        } else {
            Serial.print(" failed, rc=");
            Serial.print(mqtt.state());
            Serial.println(" retrying...");
            delay(MQTT_RECONNECT_DELAY_MS);
        }
    }
}

// Publish HA MQTT Discovery message for a single field
void publishDiscovery(int address, const char* field, const char* deviceClass, const char* unit) {
    String uid = "lora_" + String(address) + "_" + String(field);
    String discoveryTopic = "homeassistant/sensor/" + uid + "/config";

    JsonDocument doc;
    doc["name"] = String(field);
    doc["state_topic"] = String(MQTT_TOPIC_PREFIX) + "/" + String(address) + "/state";
    doc["value_template"] = "{{ value_json." + String(field) + " }}";
    doc["unique_id"] = uid;

    if (strlen(deviceClass) > 0) {
        doc["device_class"] = deviceClass;
    }
    if (strlen(unit) > 0) {
        doc["unit_of_measurement"] = unit;
    }

    // Group all fields under one device in HA
    JsonObject device = doc["device"].to<JsonObject>();
    device["identifiers"][0] = "lora_node_" + String(address);
    device["name"] = "LoRa Node " + String(address);
    device["manufacturer"] = "DIY LoRa";
    device["model"] = "RYLR998 Node";
    device["via_device"] = "lora_gateway";

    String payload;
    serializeJson(doc, payload);
    mqtt.publish(discoveryTopic.c_str(), payload.c_str(), true);

    Serial.print("Discovery: ");
    Serial.println(uid);
}

// Publish discovery for RSSI (always included)
void publishRssiDiscovery(int address) {
    String uid = "lora_" + String(address) + "_rssi";
    String discoveryTopic = "homeassistant/sensor/" + uid + "/config";

    JsonDocument doc;
    doc["name"] = "RSSI";
    doc["state_topic"] = String(MQTT_TOPIC_PREFIX) + "/" + String(address) + "/state";
    doc["value_template"] = "{{ value_json.rssi }}";
    doc["unit_of_measurement"] = "dBm";
    doc["device_class"] = "signal_strength";
    doc["unique_id"] = uid;
    doc["entity_category"] = "diagnostic";

    JsonObject device = doc["device"].to<JsonObject>();
    device["identifiers"][0] = "lora_node_" + String(address);
    device["name"] = "LoRa Node " + String(address);

    String payload;
    serializeJson(doc, payload);
    mqtt.publish(discoveryTopic.c_str(), payload.c_str(), true);
}

// Handle config response from node - register with HA
void handleConfigResponse(int address, JsonDocument& doc) {
    if (!doc["fields"].is<JsonArray>()) return;

    Serial.print("Registering node ");
    Serial.print(address);
    Serial.println(" with Home Assistant");

    // Register each field the node provides
    JsonArray fields = doc["fields"].as<JsonArray>();
    for (JsonObject field : fields) {
        const char* name = field["name"] | "";
        const char* deviceClass = field["class"] | "";
        const char* unit = field["unit"] | "";

        if (strlen(name) > 0) {
            publishDiscovery(address, name, deviceClass, unit);
        }
    }

    // Always register RSSI
    publishRssiDiscovery(address);
}

void parseLoRaMessage(const String& message) {
    // Parse: +RCV=<address>,<length>,<data>,<rssi>,<snr>
    if (!message.startsWith("+RCV=")) return;

    String params = message.substring(5);
    int comma1 = params.indexOf(',');
    int comma2 = params.indexOf(',', comma1 + 1);
    int comma3 = params.indexOf(',', comma2 + 1);
    int comma4 = params.indexOf(',', comma3 + 1);

    if (comma1 == -1 || comma2 == -1 || comma3 == -1 || comma4 == -1) return;

    int address = params.substring(0, comma1).toInt();
    int length = params.substring(comma1 + 1, comma2).toInt();
    String data = params.substring(comma2 + 1, comma3);
    int rssi = params.substring(comma3 + 1, comma4).toInt();
    float snr = params.substring(comma4 + 1).toFloat();

    Serial.print("RX from ");
    Serial.print(address);
    Serial.print(" [RSSI:");
    Serial.print(rssi);
    Serial.print(" SNR:");
    Serial.print(snr);
    Serial.print("]: ");
    Serial.println(data);

    // Parse the JSON payload
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, data);

    // Add gateway metadata
    doc["rssi"] = rssi;
    doc["snr"] = snr;

    String enrichedPayload;
    serializeJson(doc, enrichedPayload);

    // Determine which topic to publish to
    String baseTopic = String(MQTT_TOPIC_PREFIX) + "/" + String(address);

    // Check if this is a config response
    if (doc["type"].is<const char*>() && String(doc["type"].as<const char*>()) == "config") {
        handleConfigResponse(address, doc);
        mqtt.publish((baseTopic + "/debug").c_str(), enrichedPayload.c_str(), false);
        return;
    }

    // Check if this is a command response (has "ack" field)
    if (doc["ack"].is<const char*>()) {
        // Command response -> publish to debug topic (not retained)
        mqtt.publish((baseTopic + "/debug").c_str(), enrichedPayload.c_str(), false);
    } else {
        // Regular telemetry -> publish to state topic (retained)
        mqtt.publish((baseTopic + "/state").c_str(), enrichedPayload.c_str(), true);
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
    Serial.println("\n\nLoRa Gateway Starting...");

    // Initialize LoRa serial
    LORA_SERIAL.begin(LORA_BAUD, SERIAL_8N1, LORA_RX_PIN, LORA_TX_PIN);

    setupWiFi();

    mqtt.setServer(MQTT_HOST, MQTT_PORT);
    mqtt.setCallback(mqttCallback);
    mqtt.setBufferSize(512);
}

void loop() {
    if (!mqtt.connected()) {
        reconnectMQTT();
    }
    mqtt.loop();

    processLoRaSerial();
}
