"""Grok AI service for generating responses."""
from typing import Dict, List, Optional
from openai import OpenAI
from ..config import get_settings
from .config_service import config_service


class GrokService:
    """Service for interacting with Grok AI API."""

    def __init__(self):
        settings = get_settings()
        print("Initializing GrokService...")
        print(f"API Key present: {bool(settings.xai_api_key)}")

        self.client = OpenAI(
            api_key=settings.xai_api_key,
            base_url="https://api.x.ai/v1"
        ) if settings.xai_api_key else None

        self.system_prompt = config_service.get_system_prompt()
        self.conversations: Dict[str, List[Dict[str, str]]] = {}
        self.user_menu_state: Dict[str, bool] = {}

        if self.client:
            print("GrokService initialized successfully")
        else:
            print("WARNING: GrokService initialized without API key")

    def update_system_prompt(self, new_prompt: str) -> None:
        """Update the system prompt."""
        self.system_prompt = new_prompt
        print("System prompt updated in GrokService")

    def should_show_menu(self, user_id: str) -> bool:
        """Check if menu should be shown to user."""
        current_flow = config_service.get_current_flow()
        flow_data = config_service.get_flow_data(current_flow)

        if flow_data and flow_data.get("has_menu") and flow_data.get("menu_config"):
            if user_id not in self.user_menu_state:
                return True
        return False

    def build_menu_message(self, menu_config: Dict) -> str:
        """Build menu message from config."""
        message = menu_config.get("welcome_message", "") + "\n\n"

        for i, option in enumerate(menu_config.get("options", []), 1):
            message += f"{i}. {option.get('label', '')}\n"

        message += "\n" + menu_config.get("footer_message", "")
        return message

    def handle_menu_selection(
        self,
        user_id: str,
        user_message: str,
        menu_config: Dict
    ) -> Optional[str]:
        """Handle menu selection from user."""
        try:
            selection = int(user_message.strip())
            options = menu_config.get("options", [])

            if selection < 1 or selection > len(options):
                return None

            selected_option = options[selection - 1]
            return selected_option.get("response")
        except ValueError:
            return None

    async def get_response(self, user_id: str, user_message: str) -> str:
        """Get AI response for user message."""
        print(f"\nNew request to Grok:")
        print(f"  User: {user_id}")
        print(f"  Message: {user_message}")

        if not self.client:
            return "Lo siento, el servicio de IA no esta configurado correctamente."

        try:
            # Check if we should show menu
            if self.should_show_menu(user_id):
                current_flow = config_service.get_current_flow()
                menu_config = config_service.get_menu_for_flow(current_flow)

                if menu_config:
                    self.user_menu_state[user_id] = True
                    return self.build_menu_message(menu_config)

            # Check if this is a menu selection
            current_flow = config_service.get_current_flow()
            flow_data = config_service.get_flow_data(current_flow)

            if flow_data and flow_data.get("has_menu") and flow_data.get("menu_config"):
                menu_response = self.handle_menu_selection(
                    user_id, user_message, flow_data["menu_config"]
                )
                if menu_response:
                    print("  Menu response selected")
                    return menu_response

            # Normal AI response
            if user_id not in self.conversations:
                self.conversations[user_id] = []
                print("  New conversation created")

            self.conversations[user_id].append({
                "role": "user",
                "content": user_message
            })

            # Keep last 20 messages
            if len(self.conversations[user_id]) > 20:
                self.conversations[user_id] = self.conversations[user_id][-20:]
                print("  History trimmed to 20 messages")

            print("  Sending to Grok API...")
            print("  Model: grok-4-fast-reasoning")
            print(f"  Messages in context: {len(self.conversations[user_id])}")

            current_prompt = self.system_prompt or config_service.get_system_prompt()

            completion = self.client.chat.completions.create(
                model="grok-4-fast-reasoning",
                messages=[
                    {"role": "system", "content": current_prompt},
                    *self.conversations[user_id]
                ],
                temperature=0.7,
                max_tokens=1000
            )

            print("  Response received from Grok")

            assistant_message = completion.choices[0].message.content
            print(f"  Response: {assistant_message[:100]}...")

            self.conversations[user_id].append({
                "role": "assistant",
                "content": assistant_message
            })

            return assistant_message

        except Exception as error:
            print(f"\nERROR IN GROK API:")
            print(f"  Message: {str(error)}")
            return "Disculpa, hubo un error tecnico. Puedes intentar de nuevo?"

    def clear_conversation(self, user_id: str) -> None:
        """Clear conversation history for a user."""
        self.conversations[user_id] = []
        self.user_menu_state[user_id] = False
        print(f"Conversation reset for: {user_id}")

    def get_conversation_history(self, user_id: str) -> List[Dict[str, str]]:
        """Get conversation history for a user."""
        return self.conversations.get(user_id, [])


# Singleton instance
grok_service = GrokService()
