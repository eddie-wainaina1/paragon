from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Nifty by Paragon"
    app_env: str = "development"
    debug: bool = True
    secret_key: str = "dev-secret-key-change-in-production-32"

    mongodb_uri: str = "mongodb://localhost:27017/nifty"

    redis_url: str = "redis://localhost:6379/0"

    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours

    otel_service_name: str = "nifty-backend"
    otel_exporter_otlp_endpoint: str = "http://localhost:4318"
    otel_exporter: str = "console"  # "console" | "otlp"

    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


settings = Settings()
