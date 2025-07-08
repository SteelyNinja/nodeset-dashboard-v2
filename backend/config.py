#!/usr/bin/env python3
"""
Configuration settings for FastAPI backend
"""
import os
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Settings:
    """Application settings loaded from environment variables"""
    
    # Environment Configuration
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "local")
    
    # API Configuration
    API_HOST: str = os.getenv("API_HOST", "0.0.0.0")
    API_PORT: int = int(os.getenv("API_PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    
    # CORS Configuration
    CORS_ORIGINS: list = os.getenv("CORS_ORIGINS", "*").split(",")
    
    # ClickHouse Configuration (IP address from environment)
    CLICKHOUSE_HOST: str = os.getenv("CLICKHOUSE_HOST", "localhost")
    CLICKHOUSE_PORT: int = int(os.getenv("CLICKHOUSE_PORT", "8123"))
    CLICKHOUSE_USER: str = os.getenv("CLICKHOUSE_USER", "default")
    CLICKHOUSE_DATABASE: str = os.getenv("CLICKHOUSE_DATABASE", "default")
    CLICKHOUSE_ENABLED: bool = os.getenv("CLICKHOUSE_ENABLED", "true").lower() == "true"
    CLICKHOUSE_TIMEOUT: int = int(os.getenv("CLICKHOUSE_TIMEOUT", "30"))
    
    # Cache Configuration
    CACHE_TTL_SECONDS: int = int(os.getenv("CACHE_TTL_SECONDS", "900"))  # 15 minutes
    
    # Data File Paths
    DATA_DIR: str = os.getenv("DATA_DIR", "../json_data")
    
    @property
    def clickhouse_url(self) -> str:
        """Get ClickHouse HTTP URL"""
        return f"http://{self.CLICKHOUSE_HOST}:{self.CLICKHOUSE_PORT}"
    
    @property
    def is_local_environment(self) -> bool:
        """Check if running in local development environment"""
        return self.ENVIRONMENT == "local"
    
    @property
    def is_production_environment(self) -> bool:
        """Check if running in production environment"""
        return self.ENVIRONMENT == "production"

# Global settings instance
settings = Settings()