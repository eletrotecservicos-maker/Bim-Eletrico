"""
Configurações centrais do sistema BIM Elétrico.
Usa pydantic-settings para leitura de variáveis de ambiente.
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Aplicação
    APP_NAME: str = "BIM Elétrico - Analisador de Malhas de Aterramento"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Banco de dados
    DATABASE_URL: str = "postgresql+asyncpg://bim:bim123@localhost:5432/bim_eletrico"
    DATABASE_URL_SYNC: str = "postgresql://bim:bim123@localhost:5432/bim_eletrico"

    # Segurança JWT
    SECRET_KEY: str = "changeme-in-production-use-strong-random-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24h

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # Upload
    MAX_UPLOAD_SIZE_MB: int = 50

    # PDF
    PDF_OUTPUT_DIR: str = "/tmp/bim_reports"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
