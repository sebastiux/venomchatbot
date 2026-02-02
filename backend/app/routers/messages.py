"""Message sending endpoints."""
from fastapi import APIRouter
from ..models.schemas import SendMessageRequest, SendMessageResponse
from ..services.whatsapp_service import whatsapp_service

router = APIRouter(tags=["messages"])


@router.post("/v1/messages", response_model=SendMessageResponse)
async def send_message(request: SendMessageRequest):
    """Send a WhatsApp message."""
    result = await whatsapp_service.send_message(request.number, request.message)

    return SendMessageResponse(
        status="sent" if result.get("success") else "error",
        number=request.number,
        message_id=result.get("message_id")
    )
