from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Nifty by Paragon"
    app_env: str = "development"
    debug: bool = False
    secret_key: str = "dev-secret-key-change-in-production-32"

    mongodb_uri: str = "mongodb://localhost:27017/nifty"

    redis_url: str = "redis://localhost:6379/0"

    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours

    otel_service_name: str = "nifty-backend"
    otel_exporter_otlp_endpoint: str = "http://localhost:4318"
    otel_exporter: str = "none"  # "none" | "console" | "otlp"

    cors_origins: str = "http://localhost:3000"

    # Seed super-admin credentials (created once on first startup if absent)
    superadmin_email: str = "admin@nifty.internal"
    superadmin_password: str = "change-me-in-production"

    # SendGrid email
    sendgrid_api_key: str = "Some-Api-Key"
    sendgrid_from_email: str = "info@paragoneschool.com"
    sendgrid_from_name: str = "Paragon Shell"

    # Frontend base URL — used to build verification redirect links
    frontend_url: str = "http://localhost:3000"

    # Paystack payment gateway
    paystack_secret_key: str = "sk_test_change_me"
    paystack_public_key: str = "pk_test_change_me"
    # Paystack plan codes — create these once in Paystack dashboard
    paystack_org_pro_plan_code: str = ""      # monthly KES 14,999 org plan
    paystack_student_pro_plan_code: str = ""  # monthly KES 999 student plan

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


settings = Settings()
