#pragma once

/*
 * LoRa Protocol Definitions
 * Shared between gateway and nodes
 */

// Reserved Addresses
#define ADDR_GATEWAY   0      // Gateway address
#define ADDR_BROADCAST 65535  // Broadcast to all nodes

// RSSI Thresholds (dBm)
#define RSSI_EXCELLENT -70
#define RSSI_GOOD      -80
#define RSSI_FAIR      -90
// Below -90 is considered weak

// SNR Thresholds (dB)
#define SNR_EXCELLENT  7
#define SNR_GOOD       0
#define SNR_FAIR      -7
// Below -7 is considered poor

// Timing defaults (ms)
#define DEFAULT_TELEMETRY_INTERVAL  60000   // 1 minute
#define DEFAULT_HEARTBEAT_INTERVAL  30000   // 30 seconds
#define DEFAULT_OFFLINE_TIMEOUT    300000   // 5 minutes
