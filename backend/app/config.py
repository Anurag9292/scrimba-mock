from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/scrimba_db"
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE: int = 500 * 1024 * 1024  # 500 MB
    APP_NAME: str = "CodeStudio API"

    # JWT (legacy, kept for reference)
    JWT_SECRET: str = "change-me-in-production-use-a-strong-random-key"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 24

    # Supabase
    SUPABASE_URL: str | None = None
    SUPABASE_SERVICE_ROLE_KEY: str | None = None
    SUPABASE_JWT_SECRET: str | None = None

    # Google OAuth
    GOOGLE_CLIENT_ID: str | None = None
    GOOGLE_CLIENT_SECRET: str | None = None

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


settings = Settings()
