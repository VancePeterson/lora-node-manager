import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from api import router as api_router
from db import get_all_node_configs, get_app_settings, init_db
from models import NodeState
from mqtt_client import mqtt_client, nodes

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Startup
    logger.info("Starting LoRa Node Manager")
    await init_db()

    # Load saved nodes from database
    saved_nodes = await get_all_node_configs()
    for config in saved_nodes:
        nodes[config.name] = NodeState(
            name=config.name,
            address=config.address,
            node_type=config.node_type,
        )
    logger.info(f"Loaded {len(saved_nodes)} nodes from database")

    app_settings = await get_app_settings()
    await mqtt_client.start(app_settings)

    yield

    # Shutdown
    logger.info("Shutting down LoRa Node Manager")
    await mqtt_client.stop()


app = FastAPI(
    title="LoRa Node Manager",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(api_router)

# Mount static files for frontend (production)
static_path = Path(__file__).parent / "static"
if static_path.exists():
    app.mount("/", StaticFiles(directory=static_path, html=True), name="static")
