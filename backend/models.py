from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class NodeState(BaseModel):
    address: int  # Primary identifier, used in MQTT topics (e.g., lora/5/state)
    name: str = ""  # Display name (e.g., "Chicken Coop"), can be empty for undiscovered nodes
    online: bool = False
    last_seen: datetime | None = None
    rssi: int | None = None
    snr: float | None = None
    telemetry: dict[str, Any] = Field(default_factory=dict)
    packets_rx: int = 0
    gap_count: int = 0


class NodeConfig(BaseModel):
    address: int  # Primary identifier
    name: str = ""  # Display name
    description: str = ""


class GatewayStatus(BaseModel):
    last_seen: datetime | None = None
    ip: str | None = None
    uptime_seconds: int | None = None
    message_count: int = 0


class TelemetryPayload(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    data: dict[str, Any] = Field(default_factory=dict)


class RssiHistoryEntry(BaseModel):
    timestamp: datetime
    rssi: int
    snr: float


class NodeResponse(BaseModel):
    node: NodeState
    history: list[RssiHistoryEntry] = Field(default_factory=list)


class WebSocketMessage(BaseModel):
    type: str
    payload: dict[str, Any]


class AppSettings(BaseModel):
    mqtt_host: str = "localhost"
    mqtt_port: int = 1883
    mqtt_username: str | None = None
    mqtt_password: str | None = None
    mqtt_topic_prefix: str = "lora"


class MqttStatus(BaseModel):
    connected: bool = False
    host: str | None = None
    port: int | None = None
    error: str | None = None


class LogEntry(BaseModel):
    id: int | None = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    level: str = "info"  # info, warning, error
    category: str = "system"  # system, mqtt, node, command
    node_address: int | None = None  # Node address for node-related logs
    message: str
    details: dict[str, Any] | None = None


class LogFilter(BaseModel):
    node_address: int | None = None
    level: str | None = None
    category: str | None = None
    limit: int = 100
    offset: int = 0


class CommandRequest(BaseModel):
    command: str


class CommandResponse(BaseModel):
    success: bool
    address: int
    command: str
    topic: str
    message: str | None = None
