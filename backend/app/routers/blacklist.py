"""Blacklist management endpoints."""
from fastapi import APIRouter
from ..models.schemas import (
    BlacklistResponse,
    BlacklistAddRequest,
    BlacklistRemoveRequest,
    BlacklistActionResponse
)
from ..services.config_service import config_service

router = APIRouter(prefix="/api/blacklist", tags=["blacklist"])


@router.get("", response_model=BlacklistResponse)
async def get_blacklist():
    """Get all blacklisted numbers."""
    blacklist = config_service.get_blacklist()
    return BlacklistResponse(
        blacklist=blacklist,
        count=len(blacklist)
    )


@router.post("/add", response_model=BlacklistActionResponse)
async def add_to_blacklist(request: BlacklistAddRequest):
    """Add a number to the blacklist."""
    config_service.add_to_blacklist(request.number)
    blacklist = config_service.get_blacklist()

    return BlacklistActionResponse(
        status="added",
        number=request.number,
        blacklist=blacklist
    )


@router.post("/remove", response_model=BlacklistActionResponse)
async def remove_from_blacklist(request: BlacklistRemoveRequest):
    """Remove a number from the blacklist."""
    config_service.remove_from_blacklist(request.number)
    blacklist = config_service.get_blacklist()

    return BlacklistActionResponse(
        status="removed",
        number=request.number,
        blacklist=blacklist
    )
