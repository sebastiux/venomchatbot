"""Meta WhatsApp webhook endpoints."""
from fastapi import APIRouter, Request, Response, HTTPException
from ..config import get_settings
from ..services.whatsapp_service import whatsapp_service
from ..services.grok_service import grok_service
from ..services.config_service import config_service

router = APIRouter(tags=["webhook"])


@router.get("/webhook")
async def verify_webhook(request: Request):
    """Verify webhook for Meta API."""
    settings = get_settings()

    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")

    print(f"Webhook verification request:")
    print(f"  Mode: {mode}")
    print(f"  Token: {token}")
    print(f"  Challenge: {challenge}")

    if mode == "subscribe" and token == settings.meta_verify_token:
        print("Webhook verified successfully!")
        return Response(content=challenge, media_type="text/plain")

    print("Webhook verification failed!")
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/webhook")
async def handle_webhook(request: Request):
    """Handle incoming WhatsApp messages."""
    try:
        body = await request.json()
        print(f"Webhook received: {body.get('object', 'unknown')}")

        if body.get("object") != "whatsapp_business_account":
            return {"status": "ignored"}

        # Extract message data
        message_data = whatsapp_service.extract_message_data(body)

        if not message_data:
            print("No message data in webhook")
            return {"status": "no_message"}

        from_number = message_data.get("from")
        message_text = message_data.get("text")
        message_id = message_data.get("message_id")
        message_type = message_data.get("type")

        print(f"Message from {from_number}: {message_text}")

        # Skip non-text messages for now
        if message_type != "text" or not message_text:
            print(f"Skipping non-text message type: {message_type}")
            return {"status": "skipped"}

        # Check if number is blacklisted
        if config_service.is_blacklisted(from_number):
            print(f"Number {from_number} is blacklisted, ignoring")
            return {"status": "blacklisted"}

        # Skip group messages
        if "@g.us" in from_number:
            print("Skipping group message")
            return {"status": "group_ignored"}

        # Mark message as read
        await whatsapp_service.mark_as_read(message_id)

        # Handle reset command
        if message_text.lower().strip() in ["reset", "reiniciar", "limpiar"]:
            grok_service.clear_conversation(from_number)
            await whatsapp_service.send_message(
                from_number,
                "Conversacion reiniciada. Como puedo ayudarte?"
            )
            return {"status": "reset"}

        # Get AI response
        response = await grok_service.get_response(from_number, message_text)

        # Check for schedule trigger
        if "TRIGGER_SCHEDULE" in response:
            # TODO: Implement scheduling flow
            response = "Me encantaria ayudarte a agendar una cita. Por favor proporcioname tu nombre completo."

        # Send response
        result = await whatsapp_service.send_message(from_number, response)

        return {
            "status": "sent" if result.get("success") else "error",
            "message_id": result.get("message_id")
        }

    except Exception as e:
        print(f"Webhook error: {str(e)}")
        return {"status": "error", "message": str(e)}
