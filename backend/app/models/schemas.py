"""Pydantic schemas for API request/response models."""
from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any
from enum import Enum


# ============= Connection Status =============

class ConnectionStatus(str, Enum):
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    ERROR = "error"


class ConnectionStatusResponse(BaseModel):
    status: ConnectionStatus
    provider: str = "meta"
    error: Optional[str] = None
    number_id: Optional[str] = None
    timestamp: str


# ============= Health Check =============

class HealthResponse(BaseModel):
    status: str = "ok"
    uptime: float
    timestamp: str


# ============= Blacklist =============

class BlacklistResponse(BaseModel):
    blacklist: List[str]
    count: int


class BlacklistAddRequest(BaseModel):
    number: str


class BlacklistRemoveRequest(BaseModel):
    number: str


class BlacklistActionResponse(BaseModel):
    status: str
    number: str
    blacklist: List[str]


# ============= System Prompt =============

class PromptResponse(BaseModel):
    prompt: str
    current_flow: str


class PromptUpdateRequest(BaseModel):
    prompt: str


class PromptUpdateResponse(BaseModel):
    status: str
    prompt: str


# ============= Flows =============

class MenuOption(BaseModel):
    number: int
    text: str
    response: str


class FlowData(BaseModel):
    id: str
    name: str
    description: str
    system_prompt: str
    is_builtin: bool = False
    flow_type: str = "intelligent"  # intelligent or menu
    welcome_message: Optional[str] = None
    footer_message: Optional[str] = None
    menu_options: Optional[List[MenuOption]] = None


class FlowListResponse(BaseModel):
    flows: List[FlowData]
    current_flow: str


class FlowActivateRequest(BaseModel):
    flow_id: str


class FlowActivateResponse(BaseModel):
    status: str
    flow_id: str
    flow_name: str


class FlowCreateRequest(BaseModel):
    id: str
    name: str
    description: str
    system_prompt: str
    flow_type: str = "intelligent"
    welcome_message: Optional[str] = None
    footer_message: Optional[str] = None
    menu_options: Optional[List[MenuOption]] = None


class FlowUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    flow_type: Optional[str] = None
    welcome_message: Optional[str] = None
    footer_message: Optional[str] = None
    menu_options: Optional[List[MenuOption]] = None


# ============= Messages =============

class SendMessageRequest(BaseModel):
    number: str
    message: str


class SendMessageResponse(BaseModel):
    status: str
    number: str
    message_id: Optional[str] = None


# ============= Meta Webhook =============

class WebhookVerifyParams(BaseModel):
    hub_mode: str = Field(alias="hub.mode")
    hub_verify_token: str = Field(alias="hub.verify_token")
    hub_challenge: str = Field(alias="hub.challenge")


class WhatsAppMessage(BaseModel):
    from_number: str = Field(alias="from")
    id: str
    timestamp: str
    type: str
    text: Optional[Dict[str, str]] = None


class WhatsAppValue(BaseModel):
    messaging_product: str
    metadata: Dict[str, str]
    contacts: Optional[List[Dict[str, Any]]] = None
    messages: Optional[List[Dict[str, Any]]] = None
    statuses: Optional[List[Dict[str, Any]]] = None


class WhatsAppChange(BaseModel):
    value: WhatsAppValue
    field: str


class WhatsAppEntry(BaseModel):
    id: str
    changes: List[WhatsAppChange]


class WebhookPayload(BaseModel):
    object: str
    entry: List[WhatsAppEntry]


# ============= Appointment Scheduling =============

class AppointmentData(BaseModel):
    name: str
    company: str
    service: str
    email: str
    date: str  # YYYY-MM-DD
    time: str  # HH:MM
    phone: str


class DateParseRequest(BaseModel):
    text: str


class DateParseResponse(BaseModel):
    date: str  # YYYY-MM-DD
    time: str  # HH:MM
    interpretation: str
