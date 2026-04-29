#pragma once

// LoRa Configuration
// Override LORA_ADDRESS at build time: -DLORA_ADDRESS=10
#ifndef LORA_ADDRESS
#define LORA_ADDRESS 5
#endif

// RYLR998 Serial Configuration (ESP32)
#define LORA_SERIAL Serial2
#define LORA_RX_PIN 16
#define LORA_TX_PIN 17
#define LORA_BAUD 115200

// Gateway address to send telemetry to
#define GATEWAY_ADDRESS 0

// Timing
#define TELEMETRY_INTERVAL_MS 60000   // 1 minute
#define HEARTBEAT_INTERVAL_MS 30000   // 30 seconds
