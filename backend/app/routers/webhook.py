"""Meta WhatsApp webhook endpoints."""
import asyncio
import traceback
from fastapi import APIRouter, Request, Response, HTTPException, BackgroundTasks
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


async def process_message(body: dict):
    """Process incoming WhatsApp message in background."""
    try:
        # Extract message data
        message_data = whatsapp_service.extract_message_data(body)
        print(f"STEP 1 - Extracted message data: {message_data}")

        if not message_data:
            print("STEP 1 - No message data (status update), skipping")
            return

        from_number = message_data.get("from")
        message_text = message_data.get("text")
        message_id = message_data.get("message_id")
        message_type = message_data.get("type")

        print(f"STEP 2 - Message from {from_number}: {message_text} (type: {message_type})")

        # Skip non-text messages
        if message_type != "text" or not message_text:
            print(f"STEP 2 SKIP - Non-text message type: {message_type}")
            return

        # Check if number is blacklisted
        if config_service.is_blacklisted(from_number):
            print(f"STEP 2 SKIP - Number {from_number} is blacklisted")
            return

        # Skip group messages
        if "@g.us" in from_number:
            print("STEP 2 SKIP - Group message")
            return

        # Mark message as read
        print("STEP 3 - Marking message as read...")
        read_result = await whatsapp_service.mark_as_read(message_id)
        print(f"STEP 3 - Mark as read result: {read_result}")

        # Handle reset command
        if message_text.lower().strip() in ["reset", "reiniciar", "limpiar"]:
            grok_service.clear_conversation(from_number)
            result = await whatsapp_service.send_message(
                from_number,
                "Conversacion reiniciada. Como puedo ayudarte?"
            )
            print(f"STEP 3 - Reset sent: {result}")
            return

        # Get AI response
        print("STEP 4 - Getting AI response from Grok...")
        response = await grok_service.get_response(from_number, message_text)
        print(f"STEP 4 - Grok response: {response[:200] if response else 'EMPTY'}")

        # Check for schedule trigger
        if "TRIGGER_SCHEDULE" in response:
            response = "Me encantaria ayudarte a agendar una cita. Por favor proporcioname tu nombre completo."

        # Send response via WhatsApp
        print(f"STEP 5 - Sending response to {from_number}...")
        print(f"STEP 5 - Token present: {bool(whatsapp_service.jwt_token)}, Number ID: ...{whatsapp_service.number_id[-4:]}")
        result = await whatsapp_service.send_message(from_number, response)
        print(f"STEP 5 - Send result: {result}")
        print(f"{'='*50}\n")

    except Exception as e:
        print(f"\nPROCESS MESSAGE ERROR: {str(e)}")
        print(f"TRACEBACK:\n{traceback.format_exc()}")


@router.get("/test-send/{phone_number}")
async def test_send(phone_number: str):
    """Test endpoint to verify WhatsApp API is working. Call: /test-send/5217202533388"""
    import httpx

    settings = get_settings()
    number_id = settings.meta_number_id
    token = settings.meta_jwt_token
    version = settings.meta_version

    url = f"https://graph.facebook.com/{version}/{number_id}/messages"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": phone_number,
        "type": "text",
        "text": {"preview_url": False, "body": "Test desde Karuna Bot API"}
    }

    print(f"\n--- TEST SEND ---")
    print(f"URL: {url}")
    print(f"To: {phone_number}")
    print(f"Token (first 20 chars): {token[:20]}...")
    print(f"Number ID: {number_id}")

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers, timeout=30.0)
            result = {
                "status_code": response.status_code,
                "response": response.json() if response.headers.get("content-type", "").startswith("application/json") else response.text,
                "config": {
                    "number_id": number_id,
                    "api_version": version,
                    "token_present": bool(token),
                    "token_prefix": token[:20] + "..." if token else "EMPTY"
                }
            }
            print(f"Result: {result}")
            return result
    except Exception as e:
        return {"error": str(e), "config": {"number_id": number_id, "api_version": version}}


@router.post("/webhook")
async def handle_webhook(request: Request, background_tasks: BackgroundTasks):
    """Handle incoming WhatsApp webhook - return 200 immediately, process in background."""
    try:
        body = await request.json()
        print(f"\n{'='*50}")
        print(f"WEBHOOK POST received: {body.get('object', 'unknown')}")

        if body.get("object") != "whatsapp_business_account":
            print("IGNORED: Not a whatsapp_business_account object")
            return {"status": "ignored"}

        # Process message in background - return 200 to Meta immediately
        # Meta requires quick 200 response, otherwise it retries
        background_tasks.add_task(process_message, body)
        print("Message queued for background processing")

        return {"status": "received"}

    except Exception as e:
        print(f"\nWEBHOOK ERROR: {str(e)}")
        print(f"TRACEBACK:\n{traceback.format_exc()}")
        return {"status": "error", "message": str(e)}
