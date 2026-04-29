export interface NodeState {
  address: number;  // Primary identifier, used in MQTT topics
  name: string;     // Display name (can be empty for auto-discovered nodes)
  online: boolean;
  last_seen: string | null;
  rssi: number | null;
  snr: number | null;
  telemetry: Record<string, unknown>;
  packets_rx: number;
  gap_count: number;
}

export interface GatewayStatus {
  online: boolean;
  last_seen: string | null;
  firmware_version: string | null;
  uptime_seconds: number | null;
  message_count: number;
}

export interface RssiHistoryEntry {
  timestamp: string;
  rssi: number;
  snr: number;
}

export interface WebSocketMessage {
  type: string;
  payload: Record<string, unknown>;
}

export interface InitialStatePayload {
  nodes: Record<string, NodeState>;  // Keyed by address (as string)
  gateway: GatewayStatus;
}

export interface AppSettings {
  mqtt_host: string;
  mqtt_port: number;
  mqtt_username: string | null;
  mqtt_password: string | null;
  mqtt_topic_prefix: string;
}

export interface MqttStatus {
  connected: boolean;
  host: string | null;
  port: number | null;
  error: string | null;
}

export interface LogEntry {
  id: number | null;
  timestamp: string;
  level: string;
  category: string;
  node_address: number | null;  // Node address for node-related logs
  message: string;
  details: Record<string, unknown> | null;
}

// Helper to get display name for a node
export function getNodeDisplayName(node: NodeState): string {
  return node.name || `Node ${node.address}`;
}
