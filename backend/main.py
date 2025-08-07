#!/usr/bin/env python3
"""
FastAPI Backend for NodeSet Validator Dashboard
Main application entry point.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from contextlib import asynccontextmanager

# Import routers
from routers import dashboard, data, health, analytics, attestations, nodeset, operator_performance, enhanced_analytics

# Version and metadata
__version__ = "1.0.0"

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    print("🚀 FastAPI Backend Starting...")
    print(f"📊 NodeSet Validator Dashboard API v{__version__}")
    yield
    # Shutdown
    print("🔄 FastAPI Backend Shutting Down...")
    # Close ClickHouse service connections
    from services.clickhouse_service import clickhouse_service
    await clickhouse_service.close()

# Create FastAPI app
app = FastAPI(
    title="NodeSet Validator Dashboard API",
    description="REST API for NodeSet protocol validator monitoring and analytics",
    version=__version__,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(data.router, prefix="/api/data", tags=["data"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(analytics.router, prefix="/api", tags=["analytics"])
app.include_router(attestations.router, prefix="/api/attestations", tags=["attestations"])
app.include_router(nodeset.router, prefix="/api/nodeset", tags=["nodeset"])
app.include_router(operator_performance.router, prefix="/api/operator-performance", tags=["operator-performance"])
app.include_router(enhanced_analytics.router, prefix="/api/enhanced-analytics", tags=["enhanced-analytics"])

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "NodeSet Validator Dashboard API",
        "version": __version__,
        "docs": "/docs",
        "health": "/health"
    }

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler for unhandled errors"""
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": str(exc),
            "type": type(exc).__name__
        }
    )

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )