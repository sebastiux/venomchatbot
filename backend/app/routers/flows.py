"""Flow management endpoints."""
from typing import List
from fastapi import APIRouter, HTTPException
from ..models.schemas import (
    FlowData,
    FlowListResponse,
    FlowActivateRequest,
    FlowActivateResponse,
    FlowCreateRequest,
    FlowUpdateRequest,
    PromptResponse,
    PromptUpdateRequest,
    PromptUpdateResponse
)
from ..services.config_service import config_service
from ..services.grok_service import grok_service

router = APIRouter(tags=["flows"])


# ============= Prompt Endpoints =============

@router.get("/api/prompt", response_model=PromptResponse)
async def get_prompt():
    """Get current system prompt."""
    return PromptResponse(
        prompt=config_service.get_system_prompt(),
        current_flow=config_service.get_current_flow()
    )


@router.post("/api/prompt", response_model=PromptUpdateResponse)
async def update_prompt(request: PromptUpdateRequest):
    """Update system prompt."""
    config_service.update_system_prompt(request.prompt)
    grok_service.update_system_prompt(request.prompt)

    return PromptUpdateResponse(
        status="updated",
        prompt=request.prompt
    )


# ============= Flow Endpoints =============

@router.get("/api/flows", response_model=FlowListResponse)
async def get_flows():
    """Get all available flows."""
    all_flows = config_service.get_all_flows()
    current_flow = config_service.get_current_flow()

    flows = []
    for flow_id, flow_data in all_flows.items():
        flows.append(FlowData(
            id=flow_id,
            name=flow_data.get("name", flow_id),
            description=flow_data.get("description", ""),
            system_prompt=flow_data.get("prompt", ""),
            is_builtin=flow_data.get("is_builtin", False),
            flow_type="menu" if flow_data.get("has_menu") else "intelligent",
            welcome_message=flow_data.get("menu_config", {}).get("welcome_message") if flow_data.get("menu_config") else None,
            footer_message=flow_data.get("menu_config", {}).get("footer_message") if flow_data.get("menu_config") else None,
            menu_options=flow_data.get("menu_config", {}).get("options") if flow_data.get("menu_config") else None
        ))

    return FlowListResponse(
        flows=flows,
        current_flow=current_flow
    )


@router.get("/api/flows/{flow_id}", response_model=FlowData)
async def get_flow(flow_id: str):
    """Get a specific flow."""
    flow_data = config_service.get_flow_data(flow_id)

    if not flow_data:
        raise HTTPException(status_code=404, detail="Flow not found")

    return FlowData(
        id=flow_id,
        name=flow_data.get("name", flow_id),
        description=flow_data.get("description", ""),
        system_prompt=flow_data.get("prompt", ""),
        is_builtin=flow_data.get("is_builtin", False),
        flow_type="menu" if flow_data.get("has_menu") else "intelligent",
        welcome_message=flow_data.get("menu_config", {}).get("welcome_message") if flow_data.get("menu_config") else None,
        footer_message=flow_data.get("menu_config", {}).get("footer_message") if flow_data.get("menu_config") else None,
        menu_options=flow_data.get("menu_config", {}).get("options") if flow_data.get("menu_config") else None
    )


@router.post("/api/flow/activate", response_model=FlowActivateResponse)
async def activate_flow(request: FlowActivateRequest):
    """Activate a flow."""
    flow_data = config_service.get_flow_data(request.flow_id)

    if not flow_data:
        raise HTTPException(status_code=404, detail="Flow not found")

    success = config_service.set_flow(request.flow_id)

    if not success:
        raise HTTPException(status_code=400, detail="Failed to activate flow")

    # Update Grok service system prompt
    grok_service.update_system_prompt(flow_data.get("prompt", ""))

    return FlowActivateResponse(
        status="activated",
        flow_id=request.flow_id,
        flow_name=flow_data.get("name", request.flow_id)
    )


@router.post("/api/flows")
async def create_flow(request: FlowCreateRequest):
    """Create a new custom flow."""
    menu_config = None
    if request.flow_type == "menu" and request.menu_options:
        menu_config = {
            "welcome_message": request.welcome_message or "",
            "footer_message": request.footer_message or "",
            "options": [opt.dict() for opt in request.menu_options]
        }

    result = config_service.create_custom_flow(
        flow_id=request.id,
        name=request.name,
        description=request.description,
        prompt=request.system_prompt,
        has_menu=request.flow_type == "menu",
        menu_config=menu_config
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))

    return {"status": "created", "flow_id": request.id}


@router.put("/api/flows/{flow_id}")
async def update_flow(flow_id: str, request: FlowUpdateRequest):
    """Update an existing custom flow."""
    menu_config = None
    if request.flow_type == "menu" and request.menu_options:
        menu_config = {
            "welcome_message": request.welcome_message or "",
            "footer_message": request.footer_message or "",
            "options": [opt.dict() for opt in request.menu_options]
        }

    result = config_service.update_custom_flow(
        flow_id=flow_id,
        name=request.name,
        description=request.description,
        prompt=request.system_prompt,
        has_menu=request.flow_type == "menu" if request.flow_type else None,
        menu_config=menu_config
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))

    # Update Grok service if this is the current flow
    if config_service.get_current_flow() == flow_id and request.system_prompt:
        grok_service.update_system_prompt(request.system_prompt)

    return {"status": "updated", "flow_id": flow_id}


@router.delete("/api/flows/{flow_id}")
async def delete_flow(flow_id: str):
    """Delete a custom flow."""
    result = config_service.delete_custom_flow(flow_id)

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))

    return {"status": "deleted", "flow_id": flow_id}
