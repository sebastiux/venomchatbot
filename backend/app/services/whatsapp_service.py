"""WhatsApp service for Meta Business API."""
import httpx
from typing import Optional, Dict, Any
from ..config import get_settings


class WhatsAppService:
    """Service for interacting with Meta WhatsApp Business API."""

    def __init__(self):
        settings = get_settings()
        self.jwt_token = settings.meta_jwt_token
        self.number_id = settings.meta_number_id
        self.version = settings.meta_version
        self.base_url = f"https://graph.facebook.com/{self.version}/{self.number_id}"

        self.headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }

        print("WhatsApp Service initialized")
        print(f"  Number ID: ...{self.number_id[-4:] if self.number_id else 'NOT SET'}")
        print(f"  API Version: {self.version}")

    @staticmethod
    def normalize_phone_number(phone: str) -> str:
        """Normalize phone number format.

        Mexican numbers: WhatsApp webhooks send '521XXXXXXXXXX' (13 digits)
        but Meta API expects '52XXXXXXXXXX' (12 digits, without the '1' after country code).
        """
        # Remove any non-digit characters
        phone = ''.join(c for c in phone if c.isdigit())

        # Mexican numbers: 521XXXXXXXXXX (13 digits) -> 52XXXXXXXXXX (12 digits)
        if phone.startswith("521") and len(phone) == 13:
            phone = "52" + phone[3:]
            print(f"  Phone normalized (MX): 521... -> 52{phone[2:6]}...")

        return phone

    async def send_message(self, to: str, message: str) -> Dict[str, Any]:
        """Send a text message to a WhatsApp number."""
        to = self.normalize_phone_number(to)
        url = f"{self.base_url}/messages"

        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "text",
            "text": {
                "preview_url": False,
                "body": message
            }
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    json=payload,
                    headers=self.headers,
                    timeout=30.0
                )

                if response.status_code == 200:
                    data = response.json()
                    print(f"Message sent to {to}")
                    return {
                        "success": True,
                        "message_id": data.get("messages", [{}])[0].get("id")
                    }
                else:
                    print(f"Error sending message: {response.status_code}")
                    print(f"Response: {response.text}")
                    return {
                        "success": False,
                        "error": response.text
                    }

        except Exception as e:
            print(f"Exception sending message: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    async def send_template(
        self,
        to: str,
        template_name: str,
        language_code: str = "es",
        components: Optional[list] = None
    ) -> Dict[str, Any]:
        """Send a template message."""
        to = self.normalize_phone_number(to)
        url = f"{self.base_url}/messages"

        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {
                    "code": language_code
                }
            }
        }

        if components:
            payload["template"]["components"] = components

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    json=payload,
                    headers=self.headers,
                    timeout=30.0
                )

                if response.status_code == 200:
                    data = response.json()
                    return {
                        "success": True,
                        "message_id": data.get("messages", [{}])[0].get("id")
                    }
                else:
                    return {
                        "success": False,
                        "error": response.text
                    }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    async def mark_as_read(self, message_id: str) -> bool:
        """Mark a message as read."""
        url = f"{self.base_url}/messages"

        payload = {
            "messaging_product": "whatsapp",
            "status": "read",
            "message_id": message_id
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    json=payload,
                    headers=self.headers,
                    timeout=30.0
                )
                return response.status_code == 200

        except Exception as e:
            print(f"Error marking as read: {str(e)}")
            return False

    def extract_message_data(self, webhook_data: Dict) -> Optional[Dict[str, Any]]:
        """Extract message data from webhook payload."""
        try:
            entry = webhook_data.get("entry", [{}])[0]
            changes = entry.get("changes", [{}])[0]
            value = changes.get("value", {})

            messages = value.get("messages", [])
            if not messages:
                return None

            message = messages[0]
            contacts = value.get("contacts", [{}])[0]

            return {
                "from": message.get("from"),
                "message_id": message.get("id"),
                "timestamp": message.get("timestamp"),
                "type": message.get("type"),
                "text": message.get("text", {}).get("body") if message.get("type") == "text" else None,
                "name": contacts.get("profile", {}).get("name"),
                "phone_number_id": value.get("metadata", {}).get("phone_number_id")
            }

        except (KeyError, IndexError) as e:
            print(f"Error extracting message data: {str(e)}")
            return None


# Singleton instance
whatsapp_service = WhatsAppService()
