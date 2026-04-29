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
    // Parse topic: lora/{address}/command
    String topicStr = String(topic);
    int firstSlash = topicStr.indexOf('/');
    int secondSlash = topicStr.indexOf('/', firstSlash + 1);

    if (secondSlash == -1) return;

    String addressStr = topicStr.substring(firstSlash + 1, secondSlash);
    String subtopic = topicStr.substring(secondSlash + 1);

    if (subtopic != "command") return;

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

            // Subscribe to command topics for all nodes
            String commandTopic = String(MQTT_TOPIC_PREFIX) + "/+/command";
            mqtt.subscribe(commandTopic.c_str());
            Serial.print("Subscribed to: ");
            Serial.println(commandTopic);

            // Publish gateway online status
            String statusTopic = String(MQTT_TOPIC_PREFIX) + "/gateway/status";
            JsonDocument doc;
            doc["online"] = true;
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

    // Publish to MQTT using address-based topics
    String baseTopic = String(MQTT_TOPIC_PREFIX) + "/" + String(address);

    // Publish state (the data payload - could be JSON or raw)
    mqtt.publish((baseTopic + "/state").c_str(), data.c_str(), true);

    // Publish signal metrics
    mqtt.publish((baseTopic + "/rssi").c_str(), String(rssi).c_str(), true);
    mqtt.publish((baseTopic + "/snr").c_str(), String(snr, 1).c_str(), true);

    // Publish online status
    mqtt.publish((baseTopic + "/online").c_str(), "online", true);

    // Publish last seen timestamp
    mqtt.publish((baseTopic + "/last_seen").c_str(), String(millis() / 1000).c_str(), true);
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
