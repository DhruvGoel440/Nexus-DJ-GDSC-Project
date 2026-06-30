"""
Application Startup Script — Production Server Core Launcher.
Configures structural orchestration constraints for localized Uvicorn deployments.
"""

import uvicorn


def launch_application_server() -> None:
    """Spawns low-latency ASGI network loop hooks pointing to the application instance."""
    uvicorn.run(
        app="app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
        workers=1
    )


if __name__ == "__main__":
    launch_application_server()
