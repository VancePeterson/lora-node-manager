import asyncio
import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect

from db import (
    add_log,
    get_app_settings,
    get_log_categories,
    get_logs,
    get_rssi_history,
    save_app_settings,
    upsert_node_config,
)
from models import (
    AppSettings,
    CommandRequest,
    CommandResponse,
    GatewayStatus,
    LogEntry,
    MqttStatus,
    NodeConfig,
    NodeState,
    RssiHistoryEntry,
)
from mqtt_client import (
    gateway_status,
    get_node_display_name,
    mqtt_client,
    nodes,
    register_update_callback,
    unregister_update_callback,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


@router.get("/nodes", response_model=list[NodeState])
async def list_nodes() -> list[NodeState]:
    return list(nodes.values())


@router.post("/nodes", response_model=NodeState)
async def create_node(config: NodeConfig) -> NodeState:
    if config.address in nodes:
        raise HTTPException(status_code=400, detail="Node with this address already exists")

    # Save to database
    await upsert_node_config(config)

    # Add to in-memory state
    node = NodeState(
        address=config.address,
        name=config.name,
    )
    nodes[config.address] = node
    return node


@router.get("/nodes/{address}", response_model=NodeState)
async def get_node(address: int) -> NodeState:
    if address not in nodes:
        raise HTTPException(status_code=404, detail="Node not found")
    return nodes[address]


@router.put("/nodes/{address}", response_model=NodeState)
async def update_node(address: int, config: NodeConfig) -> NodeState:
    """Update a node's display name and description."""
    if address not in nodes:
        raise HTTPException(status_code=404, detail="Node not found")

    # Update database
    await upsert_node_config(config)

    # Update in-memory state
    node = nodes[address]
    node.name = config.name
    return node


@router.get("/nodes/{address}/history", response_model=list[RssiHistoryEntry])
async def get_node_history(
    address: int,
    hours: int = Query(default=24, ge=1, le=168),
    limit: int = Query(default=1000, ge=1, le=10000),
) -> list[RssiHistoryEntry]:
    if address not in nodes:
        raise HTTPException(status_code=404, detail="Node not found")
    return await get_rssi_history(address, hours=hours, limit=limit)


@router.post("/nodes/{address}/command", response_model=CommandResponse)
async def send_node_command(address: int, request: CommandRequest) -> CommandResponse:
    """Send a command to a specific node via MQTT."""
    if address not in nodes:
        raise HTTPException(status_code=404, detail="Node not found")

    node = nodes[address]
    settings = await get_app_settings()
    # Use address in MQTT topic: lora/{address}/debug
    topic = f"{settings.mqtt_topic_prefix}/{address}/debug"

    try:
        await mqtt_client.publish(topic, request.command)
        await add_log(
            f"Sent command to {get_node_display_name(node)}: {request.command}",
            level="info",
            category="command",
            node_address=address,
            details={"command": request.command, "topic": topic},
        )
        return CommandResponse(
            success=True,
            address=address,
            command=request.command,
            topic=topic,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to send command to address {address}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send command: {e}")


@router.get("/gateway", response_model=GatewayStatus)
async def get_gateway() -> GatewayStatus:
    return gateway_status


@router.get("/settings", response_model=AppSettings)
async def get_settings() -> AppSettings:
    return await get_app_settings()


@router.put("/settings", response_model=AppSettings)
async def update_settings(new_settings: AppSettings) -> AppSettings:
    await save_app_settings(new_settings)
    await mqtt_client.reconnect(new_settings)
    return new_settings


@router.get("/settings/mqtt/status", response_model=MqttStatus)
async def get_mqtt_status() -> MqttStatus:
    return mqtt_client.status


@router.get("/logs", response_model=list[LogEntry])
async def list_logs(
    node_address: int | None = Query(default=None),
    level: str | None = Query(default=None),
    category: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> list[LogEntry]:
    return await get_logs(
        node_address=node_address,
        level=level,
        category=category,
        limit=limit,
        offset=offset,
    )


@router.get("/logs/categories", response_model=list[str])
async def list_log_categories() -> list[str]:
    return await get_log_categories()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()

    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()

    def on_update(event_type: str, payload: dict[str, Any]) -> None:
        try:
            queue.put_nowait({"type": event_type, "payload": payload})
        except asyncio.QueueFull:
            logger.warning("WebSocket queue full, dropping message")

    register_update_callback(on_update)

    try:
        # Send initial state - keyed by address
        await websocket.send_json({
            "type": "initial_state",
            "payload": {
                "nodes": {str(addr): node.model_dump(mode="json") for addr, node in nodes.items()},
                "gateway": gateway_status.model_dump(mode="json"),
            },
        })

        while True:
            try:
                message = await asyncio.wait_for(queue.get(), timeout=30.0)
                await websocket.send_json(message)
            except asyncio.TimeoutError:
                # Send keepalive
                await websocket.send_json({"type": "ping", "payload": {}})

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        unregister_update_callback(on_update)
