from pydantic_settings import BaseSettings, SettingsConfigDict


class MqttSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MQTT_")

    host: str = "localhost"
    port: int = 1883
    username: str | None = None
    password: str | None = None
    topic_prefix: str = "lora"


class DatabaseSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="DB_")

    path: str = "/config/lora_manager.db"


class Settings(BaseSettings):
    mqtt: MqttSettings = MqttSettings()
    database: DatabaseSettings = DatabaseSettings()
    debug: bool = False


settings = Settings()
