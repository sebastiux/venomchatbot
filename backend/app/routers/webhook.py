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
        print(f"\n{'='*50}")
        print(f"WEBHOOK POST received: {body.get('object', 'unknown')}")

        if body.get("object") != "whatsapp_business_account":
            print("IGNORED: Not a whatsapp_business_account object")
            return {"status": "ignored"}

        # Extract message data
        message_data = whatsapp_service.extract_message_data(body)
        print(f"STEP 1 - Extracted message data: {message_data}")

        if not message_data:
            print("STEP 1 FAIL - No message data in webhook")
            return {"status": "no_message"}

        from_number = message_data.get("from")
        message_text = message_data.get("text")
        message_id = message_data.get("message_id")
        message_type = message_data.get("type")

        print(f"STEP 2 - Message from {from_number}: {message_text} (type: {message_type})")

        # Skip non-text messages for now
        if message_type != "text" or not message_text:
            print(f"STEP 2 SKIP - Non-text message type: {message_type}")
            return {"status": "skipped"}

        # Check if number is blacklisted
        if config_service.is_blacklisted(from_number):
            print(f"STEP 3 SKIP - Number {from_number} is blacklisted")
            return {"status": "blacklisted"}

        # Skip group messages
        if "@g.us" in from_number:
            print("STEP 3 SKIP - Group message")
            return {"status": "group_ignored"}

        # Mark message as read
        print("STEP 3 - Marking message as read...")
        read_result = await whatsapp_service.mark_as_read(message_id)
        print(f"STEP 3 - Mark as read result: {read_result}")

        # Handle reset command
        if message_text.lower().strip() in ["reset", "reiniciar", "limpiar"]:
            grok_service.clear_conversation(from_number)
            await whatsapp_service.send_message(
                from_number,
                "Conversacion reiniciada. Como puedo ayudarte?"
            )
            return {"status": "reset"}

        # Get AI response
        print("STEP 4 - Getting AI response from Grok...")
        response = await grok_service.get_response(from_number, message_text)
        print(f"STEP 4 - Grok response: {response[:200] if response else 'EMPTY'}...")

        # Check for schedule trigger
        if "TRIGGER_SCHEDULE" in response:
            response = "Me encantaria ayudarte a agendar una cita. Por favor proporcioname tu nombre completo."

        # Send response
        print(f"STEP 5 - Sending response to {from_number}...")
        print(f"STEP 5 - WhatsApp service number_id: {whatsapp_service.number_id}")
        print(f"STEP 5 - WhatsApp service token present: {bool(whatsapp_service.jwt_token)}")
        result = await whatsapp_service.send_message(from_number, response)
        print(f"STEP 5 - Send result: {result}")
        print(f"{'='*50}\n")

        return {
            "status": "sent" if result.get("success") else "error",
            "message_id": result.get("message_id")
        }

    except Exception as e:
        import traceback
        print(f"\nWEBHOOK ERROR: {str(e)}")
        print(f"TRACEBACK:\n{traceback.format_exc()}")
        return {"status": "error", "message": str(e)}
