"""Main FastAPI application."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pathlib import Path
import os

from .config import get_settings
from .routers import (
    health_router,
    webhook_router,
    blacklist_router,
    flows_router,
    messages_router
)

# Get settings
settings = get_settings()

# Create FastAPI app
app = FastAPI(
    title="Karuna Bot API",
    description="WhatsApp Chatbot with Meta Business API",
    version="2.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:3008",
        settings.frontend_url,
        "*"  # Allow all in production (Railway)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health_router)
app.include_router(webhook_router)
app.include_router(blacklist_router)
app.include_router(flows_router)
app.include_router(messages_router)


# Static files for frontend (when built)
# In Docker: /app/frontend/dist, in dev: ../frontend/dist
FRONTEND_BUILD_PATH = Path("/app/frontend/dist")
if not FRONTEND_BUILD_PATH.exists():
    FRONTEND_BUILD_PATH = Path(__file__).parent.parent.parent / "frontend" / "dist"

if FRONTEND_BUILD_PATH.exists():
    assets_path = FRONTEND_BUILD_PATH / "assets"
    if assets_path.exists():
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")


# Privacy Policy Page
PRIVACY_POLICY_HTML = """
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Politica de Privacidad - Karuna Bot</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
        h1 { color: #1a1a1a; }
        h2 { color: #333; margin-top: 30px; }
        p, li { color: #555; }
        .updated { color: #888; font-size: 0.9rem; }
    </style>
</head>
<body>
    <h1>Politica de Privacidad</h1>
    <p class="updated">Ultima actualizacion: Febrero 2025</p>

    <h2>1. Informacion que Recopilamos</h2>
    <p>Cuando utilizas nuestro servicio de chatbot de WhatsApp, podemos recopilar:</p>
    <ul>
        <li>Numero de telefono de WhatsApp</li>
        <li>Mensajes enviados al bot</li>
        <li>Nombre de perfil de WhatsApp</li>
        <li>Informacion proporcionada para agendar citas (nombre, empresa, email)</li>
    </ul>

    <h2>2. Como Usamos tu Informacion</h2>
    <p>Utilizamos la informacion recopilada para:</p>
    <ul>
        <li>Proporcionar respuestas automatizadas via WhatsApp</li>
        <li>Agendar y gestionar citas</li>
        <li>Mejorar nuestros servicios</li>
        <li>Comunicarnos contigo sobre consultas o servicios solicitados</li>
    </ul>

    <h2>3. Comparticion de Datos</h2>
    <p>No vendemos ni compartimos tu informacion personal con terceros, excepto:</p>
    <ul>
        <li>Meta/WhatsApp (necesario para el funcionamiento del servicio)</li>
        <li>Google Calendar (para agendar citas)</li>
        <li>Proveedores de servicios que nos ayudan a operar</li>
    </ul>

    <h2>4. Retencion de Datos</h2>
    <p>Conservamos tus datos solo durante el tiempo necesario para proporcionar nuestros servicios. Puedes solicitar la eliminacion de tus datos en cualquier momento.</p>

    <h2>5. Tus Derechos</h2>
    <p>Tienes derecho a:</p>
    <ul>
        <li>Acceder a tus datos personales</li>
        <li>Solicitar la correccion de datos inexactos</li>
        <li>Solicitar la eliminacion de tus datos</li>
        <li>Oponerte al procesamiento de tus datos</li>
    </ul>

    <h2>6. Contacto</h2>
    <p>Para cualquier consulta sobre esta politica de privacidad, contactanos en: <a href="mailto:privacy@karuna.es.com">privacy@karuna.es.com</a></p>

    <h2>7. Cambios a esta Politica</h2>
    <p>Podemos actualizar esta politica ocasionalmente. Te notificaremos sobre cambios significativos.</p>
</body>
</html>
"""

TERMS_OF_SERVICE_HTML = """
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Terminos de Servicio - Karuna Bot</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
        h1 { color: #1a1a1a; }
        h2 { color: #333; margin-top: 30px; }
        p, li { color: #555; }
        .updated { color: #888; font-size: 0.9rem; }
    </style>
</head>
<body>
    <h1>Terminos de Servicio</h1>
    <p class="updated">Ultima actualizacion: Febrero 2025</p>

    <h2>1. Aceptacion de los Terminos</h2>
    <p>Al utilizar nuestro servicio de chatbot de WhatsApp, aceptas estos terminos de servicio. Si no estas de acuerdo, por favor no utilices el servicio.</p>

    <h2>2. Descripcion del Servicio</h2>
    <p>Karuna Bot es un servicio de chatbot automatizado que:</p>
    <ul>
        <li>Proporciona informacion sobre nuestros servicios de consultoria</li>
        <li>Responde preguntas frecuentes</li>
        <li>Facilita el agendamiento de citas</li>
        <li>Ofrece soporte basico al cliente</li>
    </ul>

    <h2>3. Uso Aceptable</h2>
    <p>Te comprometes a:</p>
    <ul>
        <li>No utilizar el servicio para actividades ilegales</li>
        <li>No enviar contenido ofensivo, amenazante o inapropiado</li>
        <li>No intentar hackear o comprometer el servicio</li>
        <li>No hacer spam o enviar mensajes masivos</li>
    </ul>

    <h2>4. Limitaciones del Servicio</h2>
    <p>El chatbot es un sistema automatizado y puede tener limitaciones:</p>
    <ul>
        <li>Las respuestas son generadas por inteligencia artificial</li>
        <li>No reemplaza asesoria profesional</li>
        <li>Puede haber tiempos de inactividad por mantenimiento</li>
    </ul>

    <h2>5. Propiedad Intelectual</h2>
    <p>Todo el contenido, diseno y tecnologia del servicio son propiedad de Karuna. No esta permitida la reproduccion sin autorizacion.</p>

    <h2>6. Limitacion de Responsabilidad</h2>
    <p>No somos responsables de:</p>
    <ul>
        <li>Decisiones tomadas basadas en respuestas del chatbot</li>
        <li>Interrupciones del servicio</li>
        <li>Perdida de datos o mensajes</li>
    </ul>

    <h2>7. Modificaciones</h2>
    <p>Nos reservamos el derecho de modificar estos terminos. Los cambios seran efectivos inmediatamente despues de su publicacion.</p>

    <h2>8. Contacto</h2>
    <p>Para consultas sobre estos terminos: <a href="mailto:legal@karuna.es.com">legal@karuna.es.com</a></p>
</body>
</html>
"""


# Add privacy and terms routes to app
@app.get("/privacy", response_class=HTMLResponse)
async def privacy_policy():
    """Privacy policy page."""
    return HTMLResponse(content=PRIVACY_POLICY_HTML)


@app.get("/terms", response_class=HTMLResponse)
async def terms_of_service():
    """Terms of service page."""
    return HTMLResponse(content=TERMS_OF_SERVICE_HTML)


# Serve frontend for all other routes (SPA support)
@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    """Serve frontend application."""
    # Check if requesting a specific file
    if FRONTEND_BUILD_PATH.exists():
        file_path = FRONTEND_BUILD_PATH / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)

        # Return index.html for SPA routing
        index_path = FRONTEND_BUILD_PATH / "index.html"
        if index_path.exists():
            return FileResponse(index_path)

    # Fallback message if frontend not built
    return HTMLResponse(
        content="""
        <html>
            <head><title>Karuna Bot</title></head>
            <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1>Karuna Bot API</h1>
                <p>Backend is running. Frontend not built yet.</p>
                <p><a href="/health">Health Check</a> | <a href="/docs">API Docs</a></p>
            </body>
        </html>
        """,
        status_code=200
    )


@app.on_event("startup")
async def startup_event():
    """Application startup with configuration validation."""
    ok = "\u2705"
    fail = "\u274c"

    def check(value: str, placeholder: str = "") -> str:
        """Return OK/FAIL status for a config value."""
        if not value or value == placeholder or value.startswith("your_"):
            return fail
        return ok

    meta_token_status = check(settings.meta_jwt_token, "your_permanent_access_token_here")
    meta_number_status = check(settings.meta_number_id, "your_phone_number_id_here")
    meta_verify_status = check(settings.meta_verify_token, "your_custom_verify_token_here")
    grok_status = check(settings.xai_api_key, "your_xai_api_key_here")
    sheets_status = check(settings.google_sheet_id, "your_google_sheet_id_here")
    meet_status = check(settings.meet_link)

    meta_ready = all(s == ok for s in [meta_token_status, meta_number_status, meta_verify_status])

    print("=" * 60)
    print("  KARUNA BOT v2.0.0")
    print("=" * 60)
    print()
    print("  META WHATSAPP API:")
    print(f"    {meta_token_status} META_JWT_TOKEN    - Access token")
    print(f"    {meta_number_status} META_NUMBER_ID    - Phone number ID")
    print(f"    {meta_verify_status} META_VERIFY_TOKEN - Webhook verify token")
    print(f"       API Version: {settings.meta_version}")
    if settings.meta_number_id and not settings.meta_number_id.startswith("your_"):
        print(f"       Number ID: ...{settings.meta_number_id[-4:]}")
    print()
    print("  AI & SERVICES:")
    print(f"    {grok_status} XAI_API_KEY       - Grok AI")
    print(f"    {sheets_status} GOOGLE_SHEET_ID   - Google Sheets")
    print(f"    {meet_status} MEET_LINK         - Google Meet")
    print()
    print(f"  SERVER:")
    print(f"    Port: {settings.port}")
    print(f"    Environment: {settings.environment}")
    print(f"    API Docs: http://localhost:{settings.port}/docs")
    print()
    if not meta_ready:
        print("  *** META API NOT CONFIGURED ***")
        print("  See SETUP-META-API.md for setup instructions.")
        print()
    print("=" * 60)
