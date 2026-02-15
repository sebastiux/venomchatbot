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
        print(f"STEP 5 - Full URL: {whatsapp_service.base_url}/messages")
        result = await whatsapp_service.send_message(from_number, response)
        print(f"STEP 5 - Send result: {result}")
        if not result.get("success"):
            print(f"STEP 5 - SEND FAILED! Error: {result.get('error', 'unknown')}")
        print(f"{'='*50}\n")

    except Exception as e:
        print(f"\nPROCESS MESSAGE ERROR: {str(e)}")
        print(f"TRACEBACK:\n{traceback.format_exc()}")


@router.get("/diagnose")
async def diagnose():
    """Full diagnostic check of all services and configuration.

    Checks: credentials, Meta API connectivity, phone number info,
    WhatsApp Business Account status, Grok AI, and webhook app info.
    """
    import httpx

    settings = get_settings()
    results = {
        "overall_status": "CHECKING",
        "config_check": {},
        "meta_api_check": {},
        "whatsapp_account": {},
        "webhook_check": {},
        "grok_check": {},
        "recommendations": []
    }

    # 1. Config check
    token_ok = bool(settings.meta_jwt_token and not settings.meta_jwt_token.startswith("your_"))
    number_ok = bool(settings.meta_number_id and not settings.meta_number_id.startswith("your_"))
    verify_ok = bool(settings.meta_verify_token and not settings.meta_verify_token.startswith("your_"))

    results["config_check"] = {
        "meta_jwt_token": "SET" if token_ok else "MISSING",
        "meta_jwt_token_length": len(settings.meta_jwt_token) if settings.meta_jwt_token else 0,
        "meta_number_id": settings.meta_number_id if number_ok else "MISSING",
        "meta_verify_token": "SET" if verify_ok else "MISSING",
        "meta_version": settings.meta_version,
        "xai_api_key": "SET" if settings.xai_api_key and not settings.xai_api_key.startswith("your_") else "MISSING",
        "port": settings.port,
        "environment": settings.environment,
    }

    if not token_ok:
        results["recommendations"].append(
            "META_JWT_TOKEN not configured. Get it from: Meta Developer Portal > App > WhatsApp > API Setup"
        )
    if not number_ok:
        results["recommendations"].append(
            "META_NUMBER_ID not configured. Get it from: Meta Developer Portal > App > WhatsApp > API Setup > Phone Number ID"
        )

    # 2. Test Meta API - verify token and get phone number info
    if token_ok and number_ok:
        try:
            async with httpx.AsyncClient() as client:
                headers = {"Authorization": f"Bearer {settings.meta_jwt_token}"}

                # Test 1: Get phone number info
                url = f"https://graph.facebook.com/{settings.meta_version}/{settings.meta_number_id}"
                params = {"fields": "display_phone_number,verified_name,quality_rating,platform_type,status,name_status,is_official_business_account"}
                response = await client.get(url, headers=headers, params=params, timeout=15.0)

                if response.status_code == 200:
                    phone_data = response.json()
                    results["meta_api_check"]["token_valid"] = True
                    results["meta_api_check"]["number_id_valid"] = True
                    results["meta_api_check"]["phone_info"] = phone_data

                    # Check if it's a test number
                    display = phone_data.get("display_phone_number", "")
                    if "+1 555" in display:
                        results["meta_api_check"]["is_test_number"] = True
                        results["recommendations"].append(
                            "Using Meta TEST number. You can only send messages to numbers added as testers in Meta Developer Portal > App Roles > Roles."
                        )
                else:
                    error_data = response.json() if "application/json" in response.headers.get("content-type", "") else response.text
                    results["meta_api_check"]["token_valid"] = False
                    results["meta_api_check"]["status_code"] = response.status_code
                    results["meta_api_check"]["error"] = error_data

                    if response.status_code == 190 or "expired" in str(error_data).lower():
                        results["recommendations"].append(
                            "TOKEN EXPIRED! Temporary tokens expire every 24h. Generate a new one in Meta Developer Portal > WhatsApp > API Setup, or create a System User token for permanent access."
                        )
                    elif response.status_code == 401 or response.status_code == 403:
                        results["recommendations"].append(
                            "TOKEN INVALID or INSUFFICIENT PERMISSIONS. Re-generate in Meta Developer Portal."
                        )
                    else:
                        results["recommendations"].append(
                            f"Meta API error {response.status_code}. Check token and number_id."
                        )

                # Test 2: Get WhatsApp Business Account info
                if results["meta_api_check"].get("token_valid"):
                    waba_url = f"https://graph.facebook.com/{settings.meta_version}/{settings.meta_number_id}/whatsapp_business_profile"
                    params2 = {"fields": "about,address,description,email,profile_picture_url,websites,vertical"}
                    waba_response = await client.get(waba_url, headers=headers, params=params2, timeout=15.0)
                    if waba_response.status_code == 200:
                        results["whatsapp_account"]["business_profile"] = waba_response.json().get("data", [{}])[0] if waba_response.json().get("data") else {}
                    else:
                        results["whatsapp_account"]["error"] = f"Could not fetch business profile: {waba_response.status_code}"

                # Test 3: Check registered webhook (app subscription)
                if results["meta_api_check"].get("token_valid"):
                    try:
                        app_url = f"https://graph.facebook.com/{settings.meta_version}/{settings.meta_number_id}"
                        app_params = {"fields": "messaging_product"}
                        app_response = await client.get(app_url, headers=headers, params=app_params, timeout=15.0)
                        if app_response.status_code == 200:
                            results["webhook_check"]["messaging_product"] = app_response.json().get("messaging_product", "unknown")
                    except Exception:
                        pass

        except httpx.ConnectTimeout:
            results["meta_api_check"]["error"] = "Connection timeout to Meta API"
            results["recommendations"].append("Network timeout connecting to Meta API. Check internet/firewall.")
        except Exception as e:
            results["meta_api_check"]["error"] = str(e)
            results["recommendations"].append(f"Meta API connection error: {str(e)}")
    else:
        results["meta_api_check"]["error"] = "Token or Number ID not configured"

    # 3. Check Grok AI
    if not settings.xai_api_key or settings.xai_api_key.startswith("your_"):
        results["grok_check"]["status"] = "NOT_CONFIGURED"
        results["recommendations"].append(
            "XAI_API_KEY not set. Bot receives messages but responds with error. Get key from https://x.ai/api"
        )
    else:
        results["grok_check"]["status"] = "CONFIGURED"
        results["grok_check"]["client_ready"] = grok_service.client is not None
        results["grok_check"]["model"] = "grok-4-fast-reasoning"

    # 4. Service instances check
    results["services"] = {
        "whatsapp_service": {
            "initialized": bool(whatsapp_service.jwt_token),
            "number_id": f"...{whatsapp_service.number_id[-4:]}" if whatsapp_service.number_id else "NOT SET",
            "base_url": whatsapp_service.base_url,
        },
        "grok_service": {
            "client_ready": grok_service.client is not None,
            "active_conversations": len(grok_service.conversations),
        }
    }

    # 5. Summary
    all_ok = (
        token_ok
        and number_ok
        and results["meta_api_check"].get("token_valid") is True
        and results["grok_check"].get("status") == "CONFIGURED"
    )
    results["overall_status"] = "ALL_OK" if all_ok else "ISSUES_FOUND"

    if not results["recommendations"]:
        results["recommendations"] = [
            "All checks passed!",
            "If messages still don't arrive, check:",
            "1. Webhook URL in Meta Developer Portal matches your Railway URL",
            "2. Webhook subscriptions include 'messages' field",
            "3. App mode is Live (not Development) or recipient is a tester",
            "4. Check Railway logs for STEP 1-5 output when sending a message"
        ]

    return results


@router.get("/test-send/{phone_number}")
async def test_send(phone_number: str):
    """Test sending a text message. Call: /test-send/5217202533388

    NOTE: For test numbers, the recipient must be added as a tester
    in Meta Developer Portal > App Roles. If text messages fail,
    try /test-template/{phone_number} which uses the hello_world template.
    """
    import httpx

    settings = get_settings()
    number_id = settings.meta_number_id
    token = settings.meta_jwt_token
    version = settings.meta_version

    # Normalize phone number (Mexican numbers: 521... -> 52...)
    original_phone = phone_number
    phone_number = whatsapp_service.normalize_phone_number(phone_number)

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
    print(f"To: {phone_number} (original: {original_phone})")
    print(f"Token (first 20 chars): {token[:20]}...")
    print(f"Number ID: {number_id}")

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers, timeout=30.0)
            response_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else response.text
            result = {
                "test_type": "text_message",
                "status_code": response.status_code,
                "success": response.status_code == 200,
                "response": response_data,
                "config": {
                    "number_id": number_id,
                    "api_version": version,
                    "phone_sent_to": phone_number,
                    "phone_original": original_phone,
                }
            }

            # Add helpful error interpretation
            if response.status_code != 200:
                error_code = None
                if isinstance(response_data, dict):
                    error_code = response_data.get("error", {}).get("code")
                    error_msg = response_data.get("error", {}).get("message", "")

                    if error_code == 190:
                        result["diagnosis"] = "TOKEN EXPIRED - Generate new token in Meta Developer Portal"
                    elif error_code == 131030:
                        result["diagnosis"] = "RECIPIENT NOT IN ALLOWED LIST - Add this number as a tester in Meta Developer Portal > App Roles"
                    elif error_code == 131047:
                        result["diagnosis"] = "RE-ENGAGEMENT REQUIRED - Need to send a template message first (try /test-template/{phone})"
                    elif error_code == 131026:
                        result["diagnosis"] = "MESSAGE UNDELIVERABLE - Number may not have WhatsApp or is unreachable"
                    elif "not started" in error_msg.lower() or error_code == 131031:
                        result["diagnosis"] = "TESTING NOT STARTED - Go to Meta Developer Portal > App Review > Start Testing"
                    else:
                        result["diagnosis"] = f"Error code {error_code}: {error_msg}"

            print(f"Result: {result}")
            return result
    except Exception as e:
        return {"error": str(e), "config": {"number_id": number_id, "api_version": version}}


@router.get("/test-template/{phone_number}")
async def test_template(phone_number: str, template: str = "hello_world", lang: str = "en_US"):
    """Test sending a template message (required for initiating conversations).

    Call: /test-template/5217202533388
    Optional: /test-template/5217202533388?template=hello_world&lang=en_US

    Template messages are needed when:
    - Starting a new conversation (no user message in last 24h)
    - Using the Meta test phone number
    - App is in Development mode

    The 'hello_world' template is pre-approved by Meta for all accounts.
    """
    import httpx

    settings = get_settings()
    number_id = settings.meta_number_id
    token = settings.meta_jwt_token
    version = settings.meta_version

    original_phone = phone_number
    phone_number = whatsapp_service.normalize_phone_number(phone_number)

    url = f"https://graph.facebook.com/{version}/{number_id}/messages"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": phone_number,
        "type": "template",
        "template": {
            "name": template,
            "language": {"code": lang}
        }
    }

    print(f"\n--- TEST TEMPLATE ---")
    print(f"URL: {url}")
    print(f"To: {phone_number} (original: {original_phone})")
    print(f"Template: {template} ({lang})")

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers, timeout=30.0)
            response_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else response.text

            result = {
                "test_type": "template_message",
                "template_name": template,
                "template_language": lang,
                "status_code": response.status_code,
                "success": response.status_code == 200,
                "response": response_data,
                "config": {
                    "number_id": number_id,
                    "phone_sent_to": phone_number,
                    "phone_original": original_phone,
                }
            }

            if response.status_code != 200 and isinstance(response_data, dict):
                error_code = response_data.get("error", {}).get("code")
                error_msg = response_data.get("error", {}).get("message", "")

                if error_code == 190:
                    result["diagnosis"] = "TOKEN EXPIRED - Generate new token in Meta Developer Portal"
                elif error_code == 131030:
                    result["diagnosis"] = "RECIPIENT NOT IN ALLOWED LIST - Add number as tester in Meta Developer Portal > App Roles"
                elif error_code == 132001:
                    result["diagnosis"] = f"TEMPLATE '{template}' NOT FOUND - Check template name in Meta Developer Portal > WhatsApp > Message Templates"
                elif "not started" in error_msg.lower():
                    result["diagnosis"] = "TESTING NOT STARTED - Go to Meta Developer Portal > App Review > Start Testing"
                else:
                    result["diagnosis"] = f"Error {error_code}: {error_msg}"

            if response.status_code == 200:
                result["next_steps"] = "Template sent! The recipient should receive a message. Now they can reply and the bot will respond automatically."

            print(f"Result: {result}")
            return result
    except Exception as e:
        return {"error": str(e)}


@router.get("/message-status/{message_id}")
async def check_message_status(message_id: str):
    """Check delivery status of a sent message.

    Use the wamid from /test-send or /test-template response.
    Example: /message-status/wamid.HBgNNTIxNzIwMjUzMzM4OBUCABEYEjc0NzgxNURDM0IxRkEyOTdCNgA=
    """
    import httpx

    settings = get_settings()
    headers = {"Authorization": f"Bearer {settings.meta_jwt_token}"}

    try:
        async with httpx.AsyncClient() as client:
            url = f"https://graph.facebook.com/{settings.meta_version}/{message_id}"
            response = await client.get(url, headers=headers, timeout=15.0)
            return {
                "message_id": message_id,
                "status_code": response.status_code,
                "response": response.json() if "application/json" in response.headers.get("content-type", "") else response.text,
            }
    except Exception as e:
        return {"error": str(e)}


@router.get("/phone-info")
async def phone_info():
    """Get detailed info about the configured WhatsApp phone number.

    Shows: display number, verified name, quality rating, status,
    throughput limits, and whether it's a test or real number.
    """
    import httpx

    settings = get_settings()
    headers = {"Authorization": f"Bearer {settings.meta_jwt_token}"}

    result = {}
    try:
        async with httpx.AsyncClient() as client:
            # Get phone number details
            url = f"https://graph.facebook.com/{settings.meta_version}/{settings.meta_number_id}"
            params = {
                "fields": "display_phone_number,verified_name,quality_rating,platform_type,"
                          "status,name_status,is_official_business_account,throughput,"
                          "code_verification_status,is_pin_enabled,messaging_limit_tier"
            }
            response = await client.get(url, headers=headers, params=params, timeout=15.0)

            if response.status_code == 200:
                data = response.json()
                result["phone_number"] = data
                display = data.get("display_phone_number", "")

                # Detect test number
                if "+1 555" in display or display.startswith("+1 555"):
                    result["is_test_number"] = True
                    result["warning"] = (
                        "This is a META TEST number. Test numbers have restrictions: "
                        "can only send to numbers added in WhatsApp > API Setup > 'To' field. "
                        "Messages may show as 'accepted' but not deliver if recipient is not in the test list."
                    )
                else:
                    result["is_test_number"] = False

                # Check quality
                quality = data.get("quality_rating")
                if quality and quality != "GREEN":
                    result["quality_warning"] = f"Quality rating is {quality}. RED or YELLOW may limit message delivery."

                # Check messaging limits
                tier = data.get("messaging_limit_tier")
                if tier:
                    result["messaging_limit_tier"] = tier

            else:
                result["error"] = response.json() if "application/json" in response.headers.get("content-type", "") else response.text
                result["status_code"] = response.status_code

    except Exception as e:
        result["error"] = str(e)

    return result


@router.get("/test-send-raw/{phone_number}")
async def test_send_raw(phone_number: str):
    """Send a test message WITHOUT phone normalization.

    This sends the number exactly as provided to test if the
    normalization (521->52) is causing delivery issues.
    """
    import httpx

    settings = get_settings()
    # Only strip non-digits, NO normalization
    raw_phone = ''.join(c for c in phone_number if c.isdigit())
    normalized_phone = whatsapp_service.normalize_phone_number(phone_number)

    url = f"https://graph.facebook.com/{settings.meta_version}/{settings.meta_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {settings.meta_jwt_token}",
        "Content-Type": "application/json"
    }

    results = {}

    try:
        async with httpx.AsyncClient() as client:
            # Send with RAW number (no normalization)
            payload_raw = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": raw_phone,
                "type": "text",
                "text": {"preview_url": False, "body": f"Test SIN normalizar - enviado a: {raw_phone}"}
            }
            resp_raw = await client.post(url, json=payload_raw, headers=headers, timeout=30.0)
            results["raw_number"] = {
                "phone": raw_phone,
                "status_code": resp_raw.status_code,
                "response": resp_raw.json() if "application/json" in resp_raw.headers.get("content-type", "") else resp_raw.text
            }

            # Send with NORMALIZED number
            payload_norm = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": normalized_phone,
                "type": "text",
                "text": {"preview_url": False, "body": f"Test CON normalizar - enviado a: {normalized_phone}"}
            }
            resp_norm = await client.post(url, json=payload_norm, headers=headers, timeout=30.0)
            results["normalized_number"] = {
                "phone": normalized_phone,
                "status_code": resp_norm.status_code,
                "response": resp_norm.json() if "application/json" in resp_norm.headers.get("content-type", "") else resp_norm.text
            }

            # Compare
            raw_waid = results["raw_number"].get("response", {}).get("contacts", [{}])[0].get("wa_id", "")
            norm_waid = results["normalized_number"].get("response", {}).get("contacts", [{}])[0].get("wa_id", "")
            results["comparison"] = {
                "raw_input": raw_phone,
                "normalized_input": normalized_phone,
                "raw_wa_id": raw_waid,
                "normalized_wa_id": norm_waid,
                "wa_ids_match": raw_waid == norm_waid,
                "note": "If both return 200 but neither arrives, the issue is on Meta's side (app mode, testing, or account status)"
            }

    except Exception as e:
        results["error"] = str(e)

    return results


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
