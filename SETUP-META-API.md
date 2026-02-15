# Guia de Configuracion - Meta WhatsApp Business API

Guia paso a paso para configurar la Meta WhatsApp Business API con Karuna Bot.

---

## Requisitos Previos

- Una cuenta de Facebook personal
- Un numero de telefono que NO este registrado en WhatsApp (o que puedas desregistrar)
- Una cuenta de Meta Business (se puede crear gratis)

---

## Paso 1: Crear una cuenta de Meta Business

1. Ve a [Meta Business Suite](https://business.facebook.com/)
2. Inicia sesion con tu cuenta de Facebook
3. Si no tienes una cuenta Business, haz clic en **"Crear cuenta"**
4. Completa el nombre de tu negocio y tus datos
5. Guarda el **Business ID** (lo encontraras en la URL o en Configuracion del negocio)

---

## Paso 2: Crear una App en Meta Developers

1. Ve a [Meta for Developers](https://developers.facebook.com/apps/)
2. Haz clic en **"Crear app"**
3. Selecciona **"Otro"** como caso de uso, luego **"Business"** como tipo de app
4. Llena los datos:
   - **Nombre de la app**: Ej. "Karuna WhatsApp Bot"
   - **Email de contacto**: Tu email
   - **Cuenta Business**: Selecciona la que creaste en el Paso 1
5. Haz clic en **"Crear app"**

---

## Paso 3: Agregar WhatsApp a tu App

1. En el Dashboard de tu app, busca **"WhatsApp"** en la seccion de productos
2. Haz clic en **"Configurar"** junto a WhatsApp
3. Selecciona tu cuenta de Meta Business cuando se te solicite
4. Esto creara automaticamente una **WhatsApp Business Account (WABA)**

---

## Paso 4: Obtener el Phone Number ID

1. En el panel izquierdo, ve a **WhatsApp > API Setup** (Configuracion de API)
2. Veras una seccion **"From"** con un numero de prueba de Meta
3. El **Phone Number ID** aparece debajo del numero
4. **Copia este valor** -> lo necesitaras como `META_NUMBER_ID`

> **Nota**: Para produccion, necesitaras agregar tu propio numero de telefono:
> - Ve a **WhatsApp > API Setup > Add phone number**
> - Sigue el proceso de verificacion por SMS o llamada
> - Una vez verificado, usa el Phone Number ID de TU numero

---

## Paso 5: Generar el Access Token

### Opcion A: Token Temporal (para pruebas, expira en 24h)

1. En **WhatsApp > API Setup**, haz clic en **"Generate"** junto a "Temporary access token"
2. Copia el token generado

### Opcion B: Token Permanente (para produccion)

1. Ve a [Meta Business Settings](https://business.facebook.com/settings/)
2. En el menu izquierdo, navega a **Usuarios del sistema** (System Users)
3. Haz clic en **"Agregar"** para crear un usuario del sistema:
   - Nombre: `karuna-bot`
   - Rol: **Admin**
4. Haz clic en **"Generar token"** para ese usuario:
   - Selecciona tu app (Karuna WhatsApp Bot)
   - Permisos necesarios:
     - `whatsapp_business_management`
     - `whatsapp_business_messaging`
   - Haz clic en **"Generar token"**
5. **Copia y guarda el token** de forma segura -> este es tu `META_JWT_TOKEN`

> **IMPORTANTE**: Este token solo se muestra una vez. Guardalo en un lugar seguro.

---

## Paso 6: Configurar el archivo .env

1. Copia el archivo de ejemplo:

```bash
cp .env.example .env
```

2. Edita el archivo `.env` con tus valores:

```env
# --- META WHATSAPP (Obligatorio) ---
META_JWT_TOKEN=EAAxxxxxxx...     # Token del Paso 5
META_NUMBER_ID=1234567890         # Phone Number ID del Paso 4
META_VERIFY_TOKEN=mi_token_secreto_personalizado   # Inventalo tu (cualquier string seguro)
META_VERSION=v21.0                # Version de la API (no cambiar a menos que sea necesario)

# --- GROK AI (Obligatorio para respuestas IA) ---
XAI_API_KEY=xai-xxxxxxx          # Tu API key de https://x.ai/api

# --- SERVIDOR ---
PORT=3008
ENVIRONMENT=development
FRONTEND_URL=http://localhost:5173
```

> **Tip**: Para generar un `META_VERIFY_TOKEN` seguro, ejecuta:
> ```bash
> openssl rand -hex 32
> ```

---

## Paso 7: Configurar el Webhook

El webhook es lo que permite que tu bot reciba mensajes. Meta enviara los mensajes a la URL de tu servidor.

### 7.1 Tu servidor debe ser accesible desde internet

**Opcion A - Para desarrollo local (ngrok):**

```bash
# Instalar ngrok (si no lo tienes)
# https://ngrok.com/download

# Iniciar ngrok apuntando al puerto de tu bot
ngrok http 3008
```

Ngrok te dara una URL como `https://abc123.ngrok-free.app`. Usa esa URL.

**Opcion B - Para produccion (Railway, Render, VPS, etc.):**

Tu app ya tendra una URL publica, por ejemplo: `https://tu-app.railway.app`

### 7.2 Registrar el webhook en Meta

1. Ve a [Meta Developers](https://developers.facebook.com/apps/) > Tu App
2. En el panel izquierdo: **WhatsApp > Configuration** (Configuracion)
3. En la seccion **Webhook**, haz clic en **"Edit"** (Editar)
4. Llena los campos:
   - **Callback URL**: `https://TU_DOMINIO/webhook`
     - Ejemplo local: `https://abc123.ngrok-free.app/webhook`
     - Ejemplo produccion: `https://tu-app.railway.app/webhook`
   - **Verify token**: El mismo valor que pusiste en `META_VERIFY_TOKEN` en tu `.env`
5. Haz clic en **"Verify and save"**

> **IMPORTANTE**: Tu servidor debe estar corriendo ANTES de hacer clic en "Verify and save", ya que Meta enviara una solicitud GET de verificacion a tu URL.

### 7.3 Suscribirse a los eventos

1. Despues de verificar el webhook, veras una lista de campos de suscripcion
2. Haz clic en **"Subscribe"** junto a **`messages`**
3. Esto permite que tu bot reciba mensajes entrantes

---

## Paso 8: Iniciar el servidor

```bash
# Opcion 1: Con Docker
docker compose up --build

# Opcion 2: Sin Docker (desarrollo)
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 3008 --reload
```

Verifica que el servidor este corriendo visitando: `http://localhost:3008/health`

---

## Paso 9: Probar el bot

### Prueba rapida desde la consola de Meta

1. Ve a **WhatsApp > API Setup** en Meta Developers
2. En la seccion **"Send and receive messages"**, selecciona un numero de destino
3. Haz clic en **"Send Message"** para enviar un mensaje de prueba con template `hello_world`

### Prueba enviando un mensaje al bot

1. Desde tu celular, envia un mensaje de WhatsApp al numero configurado en Meta
2. El bot deberia:
   - Recibir el mensaje via webhook
   - Procesarlo con Grok AI
   - Responder automaticamente

### Verificar en los logs

En la terminal donde corre el servidor, deberas ver:

```
Webhook received: whatsapp_business_account
Message from 521XXXXXXXXXX: Hola
Message sent to 521XXXXXXXXXX
```

---

## Paso 10: Agregar numeros de prueba (Modo Desarrollo)

Mientras tu app este en modo desarrollo, solo puedes enviar/recibir mensajes de numeros verificados:

1. Ve a **WhatsApp > API Setup**
2. En la seccion **"To"**, haz clic en **"Manage phone number list"**
3. Agrega los numeros de telefono que usaras para probar
4. Cada numero recibira un codigo de verificacion

> **Nota**: Para quitar esta restriccion, necesitas enviar tu app a revision (Paso 11).

---

## Paso 11: Publicar la App (Produccion)

Para usar el bot con cualquier numero (sin restriccion de numeros de prueba):

1. Ve a **App Dashboard > App Review**
2. Solicita los permisos:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
3. Proporciona:
   - Descripcion de como usas la API
   - Capturas de pantalla o video demo del bot
   - URL de tu Politica de Privacidad: `https://TU_DOMINIO/privacy`
   - URL de tus Terminos de Servicio: `https://TU_DOMINIO/terms`
4. Espera la aprobacion de Meta (puede tomar de 1 a 5 dias habiles)
5. Una vez aprobada, cambia tu app de **Development** a **Live**

---

## Resolucion de Problemas

### El webhook no se verifica

- Asegura que el servidor este corriendo y accesible desde internet
- Verifica que `META_VERIFY_TOKEN` en `.env` sea identico al que pusiste en Meta
- Revisa los logs del servidor para ver la solicitud de verificacion

### No recibo mensajes

- Confirma que estas suscrito al campo `messages` en la configuracion del webhook
- Verifica que el numero que envia el mensaje esta en la lista de numeros de prueba (modo desarrollo)
- Revisa que el numero no este en la blacklist del bot

### Error 401 al enviar mensajes

- Tu `META_JWT_TOKEN` esta expirado o es incorrecto
- Si usaste un token temporal, genera uno nuevo (expiran en 24h)
- Genera un token permanente siguiendo el Paso 5, Opcion B

### Error 400 al enviar mensajes

- Verifica que `META_NUMBER_ID` sea correcto
- Asegura que el numero de destino este en formato internacional sin `+` (ej: `5215551234567`)

### El bot no responde con IA

- Verifica que `XAI_API_KEY` este configurado correctamente
- Revisa los logs por errores del servicio Grok

---

## Variables de Entorno - Referencia Rapida

| Variable | Requerida | Descripcion |
|----------|-----------|-------------|
| `META_JWT_TOKEN` | Si | Token de acceso de Meta |
| `META_NUMBER_ID` | Si | ID del numero de telefono de WhatsApp |
| `META_VERIFY_TOKEN` | Si | Token personalizado para verificar webhook |
| `META_VERSION` | No | Version de la API (default: v21.0) |
| `XAI_API_KEY` | Si | API key de Grok/x.ai |
| `GOOGLE_SHEET_ID` | No* | ID de la hoja de Google para citas |
| `GOOGLE_CREDENTIALS_PATH` | No* | Ruta al JSON de credenciales de Google |
| `MEET_LINK` | No* | Link de Google Meet |
| `KARUNA_EMAIL` | No* | Email del organizador |
| `PORT` | No | Puerto del servidor (default: 3008) |
| `ENVIRONMENT` | No | development o production |
| `FRONTEND_URL` | No | URL del frontend (default: http://localhost:5173) |

\* Requeridas solo si usas la funcionalidad de agendar citas.

---

## Enlaces Utiles

- [Meta for Developers - Apps](https://developers.facebook.com/apps/)
- [Meta Business Suite](https://business.facebook.com/)
- [Documentacion WhatsApp Business API](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Referencia de mensajes](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages)
- [Guia de Webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks)
- [Grok API](https://x.ai/api)
