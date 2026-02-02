"""Health check endpoints."""
import time
from datetime import datetime
from fastapi import APIRouter
from ..models.schemas import HealthResponse, ConnectionStatusResponse, ConnectionStatus
from ..config import get_settings

router = APIRouter(tags=["health"])

# Track server start time
START_TIME = time.time()

# Connection status (managed by webhook handler)
connection_status = ConnectionStatus.CONNECTED
last_error = None


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint for Railway."""
    return HealthResponse(
        status="ok",
        uptime=time.time() - START_TIME,
        timestamp=datetime.now().isoformat()
    )


@router.get("/api/connection-status", response_model=ConnectionStatusResponse)
async def get_connection_status():
    """Get WhatsApp connection status."""
    settings = get_settings()
    number_id = settings.meta_number_id

    return ConnectionStatusResponse(
        status=connection_status,
        provider="meta",
        error=last_error,
        number_id=f"...{number_id[-4:]}" if number_id else None,
        timestamp=datetime.now().isoformat()
    )
