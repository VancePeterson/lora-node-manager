import asyncio
import json
import logging
from datetime import datetime
from typing import Any, Callable

import aiomqtt

from db import add_log, add_rssi_history
from models import AppSettings, GatewayStatus, MqttStatus, NodeState

logger = logging.getLogger(__name__)

# In-memory state - keyed by address (int)
nodes: dict[int, NodeState] = {}
gateway_status = GatewayStatus()

# Callbacks for WebSocket broadcasts
_update_callbacks: list[Callable[[str, dict[str, Any]], None]] = []


def register_update_callback(callback: Callable[[str, dict[str, Any]], None]) -> None:
    _update_callbacks.append(callback)


def unregister_update_callback(callback: Callable[[str, dict[str, Any]], None]) -> None:
    if callback in _update_callbacks:
        _update_callbacks.remove(callback)


def _notify_update(event_type: str, payload: dict[str, Any]) -> None:
    for callback in _update_callbacks:
        try:
            callback(event_type, payload)
        except Exception as e:
            logger.error(f"Error in update callback: {e}")


def _get_or_create_node(address: int) -> NodeState:
    """Get or create a node by its address."""
    if address not in nodes:
        # Auto-discover: create node with address, empty name (user can set later)
        nodes[address] = NodeState(address=address, name="")
        logger.info(f"Auto-discovered node at address {address}")
    return nodes[address]


def get_node_display_name(node: NodeState) -> str:
    """Get display name for a node, falling back to address if no name set."""
    return node.name if node.name else f"Node {node.address}"


async def _handle_state_message(address: int, payload: dict[str, Any]) -> None:
    node = _get_or_create_node(address)
    node.telemetry = payload
    node.last_seen = datetime.utcnow()
    node.packets_rx += 1
    _notify_update("node_state", {"address": address, "state": node.model_dump(mode="json")})
    await add_log(
        f"Received telemetry from {get_node_display_name(node)}",
        level="info",
        category="node",
        node_address=address,
        details=payload,
    )


async def _handle_online_message(address: int, payload: str) -> None:
    node = _get_or_create_node(address)
    was_online = node.online
    node.online = payload.lower() == "online"
    node.last_seen = datetime.utcnow()
    _notify_update("node_online", {"address": address, "online": node.online})

    if node.online != was_online:
        await add_log(
            f"{get_node_display_name(node)} is now {'online' if node.online else 'offline'}",
            level="info" if node.online else "warning",
            category="node",
            node_address=address,
        )


async def _handle_rssi_message(address: int, payload: str) -> None:
    try:
        rssi = int(payload)
        node = _get_or_create_node(address)
        node.rssi = rssi
        node.last_seen = datetime.utcnow()
        if node.snr is not None:
            await add_rssi_history(address, rssi, node.snr)
        _notify_update("node_rssi", {"address": address, "rssi": rssi})
    except ValueError:
        logger.warning(f"Invalid RSSI value for address {address}: {payload}")


async def _handle_snr_message(address: int, payload: str) -> None:
    try:
        snr = float(payload)
        node = _get_or_create_node(address)
        node.snr = snr
        node.last_seen = datetime.utcnow()
        if node.rssi is not None:
            await add_rssi_history(address, node.rssi, snr)
        _notify_update("node_snr", {"address": address, "snr": snr})
    except ValueError:
        logger.warning(f"Invalid SNR value for address {address}: {payload}")


async def _handle_gateway_status(payload: dict[str, Any]) -> None:
    global gateway_status
    gateway_status = GatewayStatus(
        online=True,
        last_seen=datetime.utcnow(),
        firmware_version=payload.get("firmware_version"),
        uptime_seconds=payload.get("uptime_seconds"),
        message_count=gateway_status.message_count + 1,
    )
    _notify_update("gateway_status", gateway_status.model_dump(mode="json"))


class MqttClient:
    def __init__(self) -> None:
        self._client: aiomqtt.Client | None = None
        self._task: asyncio.Task[None] | None = None
        self._running = False
        self._settings: AppSettings | None = None
        self._connected = False
        self._last_error: str | None = None

    @property
    def status(self) -> MqttStatus:
        return MqttStatus(
            connected=self._connected,
            host=self._settings.mqtt_host if self._settings else None,
            port=self._settings.mqtt_port if self._settings else None,
            error=self._last_error,
        )

    async def start(self, app_settings: AppSettings) -> None:
        self._settings = app_settings
        self._running = True
        self._task = asyncio.create_task(self._run())
        logger.info("MQTT client started")

    async def stop(self) -> None:
        self._running = False
        self._connected = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("MQTT client stopped")

    async def reconnect(self, app_settings: AppSettings) -> None:
        """Reconnect with new settings."""
        logger.info(f"Reconnecting MQTT to {app_settings.mqtt_host}:{app_settings.mqtt_port}")
        await self.stop()
        await self.start(app_settings)

    async def publish(self, topic: str, payload: str) -> None:
        """Publish a message to an MQTT topic."""
        if not self._client or not self._connected:
            raise RuntimeError("MQTT client not connected")
        await self._client.publish(topic, payload)
        logger.info(f"Published to {topic}: {payload}")

    async def _process_message(self, topic: str, payload_bytes: bytes) -> None:
        if not self._settings:
            return

        prefix = self._settings.mqtt_topic_prefix
        topic_parts = topic.split("/")

        if len(topic_parts) < 2 or topic_parts[0] != prefix:
            return

        try:
            payload_str = payload_bytes.decode("utf-8")
        except UnicodeDecodeError:
            logger.warning(f"Invalid UTF-8 payload on {topic}")
            return

        # Gateway status: lora/gateway/status
        if len(topic_parts) == 3 and topic_parts[1] == "gateway" and topic_parts[2] == "status":
            try:
                payload = json.loads(payload_str)
                await _handle_gateway_status(payload)
            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON on {topic}")
            return

        # Node messages: lora/{address}/{type}
        if len(topic_parts) == 3:
            address_str = topic_parts[1]
            msg_type = topic_parts[2]

            # Parse address as integer
            try:
                address = int(address_str)
            except ValueError:
                # Not a numeric address, ignore (could be legacy topic)
                logger.debug(f"Ignoring non-numeric address in topic: {topic}")
                return

            if msg_type == "state":
                try:
                    payload = json.loads(payload_str)
                    await _handle_state_message(address, payload)
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON on {topic}")
            elif msg_type == "online":
                await _handle_online_message(address, payload_str)
            elif msg_type == "rssi":
                await _handle_rssi_message(address, payload_str)
            elif msg_type == "snr":
                await _handle_snr_message(address, payload_str)

    async def _run(self) -> None:
        if not self._settings:
            logger.error("MQTT settings not configured")
            return

        while self._running:
            try:
                self._last_error = None
                async with aiomqtt.Client(
                    hostname=self._settings.mqtt_host,
                    port=self._settings.mqtt_port,
                    username=self._settings.mqtt_username,
                    password=self._settings.mqtt_password,
                ) as client:
                    self._client = client
                    self._connected = True
                    topic = f"{self._settings.mqtt_topic_prefix}/#"
                    await client.subscribe(topic)
                    logger.info(f"Connected to MQTT broker at {self._settings.mqtt_host}:{self._settings.mqtt_port}")
                    logger.info(f"Subscribed to {topic}")
                    _notify_update("mqtt_status", self.status.model_dump())
                    await add_log(
                        f"Connected to MQTT broker at {self._settings.mqtt_host}:{self._settings.mqtt_port}",
                        level="info",
                        category="mqtt",
                    )

                    async for message in client.messages:
                        topic_str = str(message.topic)
                        payload = message.payload
                        if isinstance(payload, bytes):
                            await self._process_message(topic_str, payload)

            except aiomqtt.MqttError as e:
                self._connected = False
                self._last_error = str(e)
                logger.error(f"MQTT error: {e}")
                _notify_update("mqtt_status", self.status.model_dump())
                await add_log(
                    f"MQTT connection error: {e}",
                    level="error",
                    category="mqtt",
                )
                if self._running:
                    await asyncio.sleep(5)
            except asyncio.CancelledError:
                self._connected = False
                break
            except Exception as e:
                self._connected = False
                self._last_error = str(e)
                logger.exception(f"Unexpected error in MQTT client: {e}")
                _notify_update("mqtt_status", self.status.model_dump())
                if self._running:
                    await asyncio.sleep(5)


mqtt_client = MqttClient()
