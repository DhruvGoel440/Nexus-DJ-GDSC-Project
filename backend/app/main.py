"""
Transitions Analytical System — FastAPI Central Boot Gateway.
Restructured with custom lifespan orchestration and metrics hooks.
"""

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import console_router, execute_telemetry_loop
from app.audio.engine import master_playback_hub


@asynccontextmanager
async def application_lifecycle_manager(_service_instance: FastAPI):
    """Handles background event loops and audio hardware pipelines on startup/shutdown."""
    # Initialize the core physical audio driver playback hub
    master_playback_hub.engage_engine()
    
    # Spawn the isolated background asynchronous streaming socket thread
    telemetry_worker = asyncio.create_task(execute_telemetry_loop())
    
    yield
    
    # Clean shutdown routine execution
    telemetry_worker.cancel()
    master_playback_hub.terminate_engine()


def assemble_app_instantiation() -> FastAPI:
    """Configures and wraps the FastAPI application ecosystem parameters."""
    core_app = FastAPI(
        title="Nexus Virtual DJ Framework",
        version="2.0.0",
        lifespan=application_lifecycle_manager
    )

    # SECURE EXPLICIT LOCAL ORIGINS TO ALLOW CREDENTIALED UPGRADES
    development_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # Apply cross-origin resource policy layer configurations
    core_app.add_middleware(
        CORSMiddleware,
        allow_origins=development_origins, # Changed from "*"
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Attach versioned api routing modules 
    core_app.include_router(console_router, prefix="/api/v2")
    
    return core_app


app = assemble_app_instantiation()


@app.get("/health")
def fetch_system_status() -> dict:
    """Provides heartbeat check for network ping verifications."""
    return {
        "status": "online",
        "engine_build": "2.0.0-Nexus",
        "interactive_documentation": "/docs"
    }