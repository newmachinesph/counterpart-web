from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://counterpart:counterpart@localhost:5432/counterpart"
    app_env: str = "local"
    web_url: str = "http://localhost:3010"
    public_api_url: str = "http://localhost:8010"
    ably_api_key: str = ""
    upstash_redis_rest_url: str = ""
    upstash_redis_rest_token: str = ""
    redis_url: str = ""
    qstash_url: str = "https://qstash.upstash.io"
    qstash_token: str = ""
    qstash_current_signing_key: str = ""
    qstash_next_signing_key: str = ""
    qstash_callback_url: str = ""
    verification_enabled: bool = False
    didit_api_key: str = ""
    didit_workflow_id: str = ""
    didit_webhook_secret: str = ""
    s3_endpoint_url: str = "http://minio:9000"
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_bucket: str = "counterpart"
    s3_region: str = "us-east-1"
    s3_public_url: str = ""
    proving_run_days: int = 45
    equity_cap_pct: float = 40.0
    resource_clause_pct: float = 25.0
    cors_origins: str = "http://localhost:3000"
    smtp_host: str = ""
    smtp_port: int = 1025
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_starttls: bool = False
    smtp_from: str = "Counterpart <notifications@counterpart.local>"


settings = Settings()
