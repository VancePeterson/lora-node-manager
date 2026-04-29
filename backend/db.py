import aiosqlite
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import AsyncGenerator

import json

from config import settings
from models import AppSettings, LogEntry, NodeConfig, RssiHistoryEntry

_db_path: str = settings.database.path


async def init_db() -> None:
    async with aiosqlite.connect(_db_path) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS nodes (
                name TEXT PRIMARY KEY,
                address INTEGER NOT NULL,
                description TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS rssi_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                node_name TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                rssi INTEGER NOT NULL,
                snr REAL NOT NULL,
                FOREIGN KEY (node_name) REFERENCES nodes(name)
            )
        """)
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_rssi_history_node_time
            ON rssi_history(node_name, timestamp DESC)
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                level TEXT NOT NULL DEFAULT 'info',
                category TEXT NOT NULL DEFAULT 'system',
                node_name TEXT,
                message TEXT NOT NULL,
                details TEXT
            )
        """)
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_logs_timestamp
            ON logs(timestamp DESC)
        """)
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_logs_node
            ON logs(node_name, timestamp DESC)
        """)
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_logs_category
            ON logs(category, timestamp DESC)
        """)
        await db.commit()


@asynccontextmanager
async def get_db() -> AsyncGenerator[aiosqlite.Connection, None]:
    async with aiosqlite.connect(_db_path) as db:
        db.row_factory = aiosqlite.Row
        yield db


async def get_node_config(name: str) -> NodeConfig | None:
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT name, address, description FROM nodes WHERE name = ?",
            (name,),
        )
        row = await cursor.fetchone()
        if row:
            return NodeConfig(
                name=row["name"],
                address=row["address"],
                description=row["description"],
            )
        return None


async def get_all_node_configs() -> list[NodeConfig]:
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT name, address, description FROM nodes"
        )
        rows = await cursor.fetchall()
        return [
            NodeConfig(
                name=row["name"],
                address=row["address"],
                description=row["description"],
            )
            for row in rows
        ]


async def upsert_node_config(config: NodeConfig) -> None:
    now = datetime.utcnow().isoformat()
    async with get_db() as db:
        await db.execute(
            """
            INSERT INTO nodes (name, address, description, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
                address = excluded.address,
                description = excluded.description,
                updated_at = excluded.updated_at
            """,
            (config.name, config.address, config.description, now, now),
        )
        await db.commit()


async def add_rssi_history(node_name: str, rssi: int, snr: float) -> None:
    now = datetime.utcnow().isoformat()
    async with get_db() as db:
        await db.execute(
            "INSERT INTO rssi_history (node_name, timestamp, rssi, snr) VALUES (?, ?, ?, ?)",
            (node_name, now, rssi, snr),
        )
        await db.commit()


async def get_rssi_history(
    node_name: str, hours: int = 24, limit: int = 1000
) -> list[RssiHistoryEntry]:
    cutoff = (datetime.utcnow() - timedelta(hours=hours)).isoformat()
    async with get_db() as db:
        cursor = await db.execute(
            """
            SELECT timestamp, rssi, snr FROM rssi_history
            WHERE node_name = ? AND timestamp > ?
            ORDER BY timestamp DESC
            LIMIT ?
            """,
            (node_name, cutoff, limit),
        )
        rows = await cursor.fetchall()
        return [
            RssiHistoryEntry(
                timestamp=datetime.fromisoformat(row["timestamp"]),
                rssi=row["rssi"],
                snr=row["snr"],
            )
            for row in rows
        ]


async def cleanup_old_history(days: int = 7) -> int:
    cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
    async with get_db() as db:
        cursor = await db.execute(
            "DELETE FROM rssi_history WHERE timestamp < ?", (cutoff,)
        )
        await db.commit()
        return cursor.rowcount


async def get_app_settings() -> AppSettings:
    """Get app settings from DB, falling back to env var defaults."""
    defaults = AppSettings(
        mqtt_host=settings.mqtt.host,
        mqtt_port=settings.mqtt.port,
        mqtt_username=settings.mqtt.username,
        mqtt_password=settings.mqtt.password,
        mqtt_topic_prefix=settings.mqtt.topic_prefix,
    )

    async with get_db() as db:
        cursor = await db.execute("SELECT key, value FROM app_settings")
        rows = await cursor.fetchall()

    stored = {row["key"]: row["value"] for row in rows}

    return AppSettings(
        mqtt_host=stored.get("mqtt_host", defaults.mqtt_host),
        mqtt_port=int(stored.get("mqtt_port", defaults.mqtt_port)),
        mqtt_username=stored.get("mqtt_username") or defaults.mqtt_username,
        mqtt_password=stored.get("mqtt_password") or defaults.mqtt_password,
        mqtt_topic_prefix=stored.get("mqtt_topic_prefix", defaults.mqtt_topic_prefix),
    )


async def save_app_settings(app_settings: AppSettings) -> None:
    """Save app settings to the database."""
    async with get_db() as db:
        settings_dict = {
            "mqtt_host": app_settings.mqtt_host,
            "mqtt_port": str(app_settings.mqtt_port),
            "mqtt_username": app_settings.mqtt_username or "",
            "mqtt_password": app_settings.mqtt_password or "",
            "mqtt_topic_prefix": app_settings.mqtt_topic_prefix,
        }
        for key, value in settings_dict.items():
            await db.execute(
                """
                INSERT INTO app_settings (key, value) VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
                """,
                (key, value),
            )
        await db.commit()


async def add_log(
    message: str,
    level: str = "info",
    category: str = "system",
    node_name: str | None = None,
    details: dict | None = None,
) -> None:
    """Add a log entry to the database."""
    now = datetime.utcnow().isoformat()
    details_json = json.dumps(details) if details else None
    async with get_db() as db:
        await db.execute(
            """
            INSERT INTO logs (timestamp, level, category, node_name, message, details)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (now, level, category, node_name, message, details_json),
        )
        await db.commit()


async def get_logs(
    node_name: str | None = None,
    level: str | None = None,
    category: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[LogEntry]:
    """Query logs with optional filters."""
    query = "SELECT id, timestamp, level, category, node_name, message, details FROM logs WHERE 1=1"
    params: list = []

    if node_name:
        query += " AND node_name = ?"
        params.append(node_name)
    if level:
        query += " AND level = ?"
        params.append(level)
    if category:
        query += " AND category = ?"
        params.append(category)

    query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    async with get_db() as db:
        cursor = await db.execute(query, params)
        rows = await cursor.fetchall()
        return [
            LogEntry(
                id=row["id"],
                timestamp=datetime.fromisoformat(row["timestamp"]),
                level=row["level"],
                category=row["category"],
                node_name=row["node_name"],
                message=row["message"],
                details=json.loads(row["details"]) if row["details"] else None,
            )
            for row in rows
        ]


async def get_log_categories() -> list[str]:
    """Get distinct log categories."""
    async with get_db() as db:
        cursor = await db.execute("SELECT DISTINCT category FROM logs ORDER BY category")
        rows = await cursor.fetchall()
        return [row["category"] for row in rows]


async def cleanup_old_logs(days: int = 30) -> int:
    """Delete logs older than specified days."""
    cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
    async with get_db() as db:
        cursor = await db.execute("DELETE FROM logs WHERE timestamp < ?", (cutoff,))
        await db.commit()
        return cursor.rowcount
