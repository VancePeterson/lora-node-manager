#pragma once

// WiFi Configuration
#define WIFI_SSID "your-ssid"
#define WIFI_PASSWORD "your-password"

// MQTT Configuration
#define MQTT_HOST "192.168.0.13"
#define MQTT_PORT 1883
#define MQTT_USER ""
#define MQTT_PASSWORD ""
#define MQTT_CLIENT_ID "lora-gateway"
#define MQTT_TOPIC_PREFIX "lora"

// RYLR998 Serial Configuration
#define LORA_SERIAL Serial2
#define LORA_RX_PIN 16
#define LORA_TX_PIN 17
#define LORA_BAUD 115200

// Gateway LoRa Address (should not conflict with nodes)
#define GATEWAY_ADDRESS 0

// Timeouts
#define NODE_OFFLINE_TIMEOUT_MS 300000  // 5 minutes
#define MQTT_RECONNECT_DELAY_MS 5000
#define LORA_COMMAND_TIMEOUT_MS 2000
