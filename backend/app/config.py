import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


def normalize_database_url(raw_url: str) -> str:
    if raw_url.startswith("postgresql://"):
        return raw_url.replace("postgresql://", "postgresql+psycopg://", 1)
    return raw_url


@dataclass(frozen=True)
class Settings:
    database_url: str = normalize_database_url(os.getenv("DATABASE_URL", ""))
    cors_origins: tuple[str, ...] = tuple(
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
        if origin.strip()
    )
    supabase_url: str = os.getenv("SUPABASE_URL", "")
    supabase_anon_key: str = os.getenv("SUPABASE_ANON_KEY", "")
    supabase_service_role_key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    jwt_secret: str = os.getenv("JWT_SECRET", "change-me")
    token_ttl_seconds: int = int(os.getenv("TOKEN_TTL_SECONDS", "3600"))
    etherscan_api_key: str = os.getenv("ETHERSCAN_API_KEY", "")
    etherscan_chain_id: str = os.getenv("ETHERSCAN_CHAIN_ID", "1")
    etherscan_api_url: str = os.getenv(
        "ETHERSCAN_API_URL", "https://api.etherscan.io/v2/api"
    )
    binance_api_url: str = os.getenv("BINANCE_API_URL", "https://api.binance.com")
    exchange_credentials_secret: str = os.getenv(
        "EXCHANGE_CREDENTIALS_SECRET", os.getenv("JWT_SECRET", "change-me")
    )


settings = Settings()
