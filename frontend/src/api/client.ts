import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  NodeState,
  GatewayStatus,
  RssiHistoryEntry,
  WebSocketMessage,
  InitialStatePayload,
  AppSettings,
  MqttStatus,
  LogEntry,
} from '../types';

const API_BASE = './api';

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchNodes(): Promise<NodeState[]> {
  return fetchJson<NodeState[]>('/nodes');
}

export interface CreateNodeRequest {
  name: string;
  address: number;
}

export async function createNode(node: CreateNodeRequest): Promise<NodeState> {
  const response = await fetch(`${API_BASE}/nodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(node),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchNode(name: string): Promise<NodeState> {
  return fetchJson<NodeState>(`/nodes/${encodeURIComponent(name)}`);
}

export async function fetchNodeHistory(
  name: string,
  hours = 24
): Promise<RssiHistoryEntry[]> {
  return fetchJson<RssiHistoryEntry[]>(
    `/nodes/${encodeURIComponent(name)}/history?hours=${hours}`
  );
}

export async function fetchGateway(): Promise<GatewayStatus> {
  return fetchJson<GatewayStatus>('/gateway');
}

export async function fetchSettings(): Promise<AppSettings> {
  return fetchJson<AppSettings>('/settings');
}

export async function updateSettings(settings: AppSettings): Promise<AppSettings> {
  const response = await fetch(`${API_BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchMqttStatus(): Promise<MqttStatus> {
  return fetchJson<MqttStatus>('/settings/mqtt/status');
}

export interface LogFilter {
  node_name?: string;
  level?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

export async function fetchLogs(filter: LogFilter = {}): Promise<LogEntry[]> {
  const params = new URLSearchParams();
  if (filter.node_name) params.set('node_name', filter.node_name);
  if (filter.level) params.set('level', filter.level);
  if (filter.category) params.set('category', filter.category);
  if (filter.limit) params.set('limit', filter.limit.toString());
  if (filter.offset) params.set('offset', filter.offset.toString());

  const query = params.toString();
  return fetchJson<LogEntry[]>(`/logs${query ? `?${query}` : ''}`);
}

export async function fetchLogCategories(): Promise<string[]> {
  return fetchJson<string[]>('/logs/categories');
}

export interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onInitialState?: (state: InitialStatePayload) => void;
  onError?: (error: Event) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}${API_BASE}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = window.setTimeout(connect, 3000);
    };

    ws.onerror = (event) => {
      options.onError?.(event);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        if (message.type === 'initial_state') {
          options.onInitialState?.(message.payload as unknown as InitialStatePayload);
        } else if (message.type !== 'ping') {
          options.onMessage?.(message);
        }
      } catch {
        console.error('Failed to parse WebSocket message');
      }
    };
  }, [options]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { isConnected };
}
