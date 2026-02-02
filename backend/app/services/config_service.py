"""Configuration service for managing bot settings."""
import json
import os
import re
from datetime import datetime
from typing import Dict, List, Optional, Any
from ..config import get_settings
from .flow_prompts import FLOW_PROMPTS


class ConfigService:
    """Service for managing bot configuration."""

    def __init__(self):
        settings = get_settings()
        self.config_path = settings.config_file_path
        self._ensure_config_file()

    def _ensure_config_file(self) -> None:
        """Ensure config file and directory exist."""
        try:
            config_dir = os.path.dirname(self.config_path)

            if config_dir and not os.path.exists(config_dir):
                os.makedirs(config_dir, exist_ok=True)

            if not os.path.exists(self.config_path):
                default_config = {
                    "blacklist": [],
                    "currentFlow": "karuna",
                    "systemPrompt": FLOW_PROMPTS["karuna"]["prompt"],
                    "customFlows": {}
                }
                self._save_config(default_config)
                print("Config file created")
        except Exception as e:
            print(f"Warning: Could not create config file: {e}")
            # Continue without persistent config - will use in-memory defaults

    def _get_config(self) -> Dict[str, Any]:
        """Read configuration from file."""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            print(f"Error reading config: {e}")
            return {
                "blacklist": [],
                "systemPrompt": "",
                "currentFlow": "karuna",
                "customFlows": {}
            }

    def _save_config(self, config: Dict[str, Any]) -> bool:
        """Save configuration to file."""
        try:
            with open(self.config_path, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"Error saving config: {e}")
            return False

    # ============= Blacklist Methods =============

    def get_blacklist(self) -> List[str]:
        """Get list of blacklisted numbers."""
        config = self._get_config()
        return config.get("blacklist", [])

    def add_to_blacklist(self, number: str) -> bool:
        """Add a number to blacklist."""
        config = self._get_config()
        if number not in config["blacklist"]:
            config["blacklist"].append(number)
            self._save_config(config)
            print(f"Number {number} added to blacklist")
            return True
        return False

    def remove_from_blacklist(self, number: str) -> bool:
        """Remove a number from blacklist."""
        config = self._get_config()
        config["blacklist"] = [n for n in config["blacklist"] if n != number]
        self._save_config(config)
        print(f"Number {number} removed from blacklist")
        return True

    def is_blacklisted(self, number: str) -> bool:
        """Check if a number is blacklisted."""
        return number in self.get_blacklist()

    # ============= System Prompt Methods =============

    def get_system_prompt(self) -> str:
        """Get current system prompt."""
        config = self._get_config()
        return config.get("systemPrompt", "")

    def update_system_prompt(self, new_prompt: str) -> bool:
        """Update system prompt."""
        config = self._get_config()
        config["systemPrompt"] = new_prompt
        self._save_config(config)
        print("System prompt updated")
        return True

    # ============= Flow Methods =============

    def get_current_flow(self) -> str:
        """Get current active flow ID."""
        config = self._get_config()
        return config.get("currentFlow", "karuna")

    def get_all_flows(self) -> Dict[str, Any]:
        """Get all flows (builtin + custom)."""
        config = self._get_config()
        custom_flows = config.get("customFlows", {})

        all_flows = {}

        # Add builtin flows
        for key, value in FLOW_PROMPTS.items():
            all_flows[key] = {**value, "is_builtin": True}

        # Add custom flows
        for key, value in custom_flows.items():
            all_flows[key] = {**value, "is_builtin": False}

        return all_flows

    def get_flow_data(self, flow_id: str) -> Optional[Dict[str, Any]]:
        """Get data for a specific flow."""
        all_flows = self.get_all_flows()
        return all_flows.get(flow_id)

    def set_flow(self, flow_id: str) -> bool:
        """Set the active flow."""
        flow_data = self.get_flow_data(flow_id)

        if not flow_data:
            print(f"Invalid flow: {flow_id}")
            return False

        config = self._get_config()
        config["currentFlow"] = flow_id
        config["systemPrompt"] = flow_data.get("prompt", "")
        self._save_config(config)
        print(f"Flow changed to: {flow_id}")
        return True

    def create_custom_flow(
        self,
        flow_id: str,
        name: str,
        description: str,
        prompt: str,
        has_menu: bool = False,
        menu_config: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Create a new custom flow."""
        # Validate flow_id doesn't exist in builtin flows
        if flow_id in FLOW_PROMPTS:
            return {"success": False, "message": "Cannot use builtin flow ID"}

        # Validate flow_id format
        if not re.match(r'^[a-z0-9_]+$', flow_id):
            return {"success": False, "message": "ID can only contain lowercase letters, numbers, and underscores"}

        config = self._get_config()
        if "customFlows" not in config:
            config["customFlows"] = {}

        if flow_id in config["customFlows"]:
            return {"success": False, "message": "Custom flow with this ID already exists"}

        config["customFlows"][flow_id] = {
            "name": name,
            "description": description,
            "prompt": prompt,
            "has_menu": has_menu,
            "menu_config": menu_config,
            "created_at": datetime.now().isoformat()
        }

        self._save_config(config)
        print(f"Custom flow created: {flow_id}")
        return {"success": True, "message": "Flow created successfully"}

    def update_custom_flow(
        self,
        flow_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        prompt: Optional[str] = None,
        has_menu: Optional[bool] = None,
        menu_config: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Update an existing custom flow."""
        if flow_id in FLOW_PROMPTS:
            return {"success": False, "message": "Cannot edit builtin flows"}

        config = self._get_config()

        if "customFlows" not in config or flow_id not in config["customFlows"]:
            return {"success": False, "message": "Custom flow not found"}

        flow = config["customFlows"][flow_id]

        if name is not None:
            flow["name"] = name
        if description is not None:
            flow["description"] = description
        if prompt is not None:
            flow["prompt"] = prompt
        if has_menu is not None:
            flow["has_menu"] = has_menu
        if menu_config is not None:
            flow["menu_config"] = menu_config

        flow["updated_at"] = datetime.now().isoformat()

        # Update system prompt if this is the current flow
        if config.get("currentFlow") == flow_id and prompt:
            config["systemPrompt"] = prompt

        self._save_config(config)
        print(f"Custom flow updated: {flow_id}")
        return {"success": True, "message": "Flow updated successfully"}

    def delete_custom_flow(self, flow_id: str) -> Dict[str, Any]:
        """Delete a custom flow."""
        if flow_id in FLOW_PROMPTS:
            return {"success": False, "message": "Cannot delete builtin flows"}

        config = self._get_config()

        if "customFlows" not in config or flow_id not in config["customFlows"]:
            return {"success": False, "message": "Custom flow not found"}

        # Switch to karuna if deleting current flow
        if config.get("currentFlow") == flow_id:
            config["currentFlow"] = "karuna"
            config["systemPrompt"] = FLOW_PROMPTS["karuna"]["prompt"]

        del config["customFlows"][flow_id]
        self._save_config(config)

        print(f"Custom flow deleted: {flow_id}")
        return {"success": True, "message": "Flow deleted successfully"}

    def get_menu_for_flow(self, flow_id: str) -> Optional[Dict]:
        """Get menu configuration for a flow."""
        flow_data = self.get_flow_data(flow_id)
        if not flow_data or not flow_data.get("has_menu"):
            return None
        return flow_data.get("menu_config")


# Singleton instance
config_service = ConfigService()
