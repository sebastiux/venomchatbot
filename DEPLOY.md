# Karuna Bot - Railway Deployment Guide

This guide will help you deploy the Karuna WhatsApp Bot to Railway using the Meta WhatsApp Business API.

**Stack:** Python (FastAPI) Backend + React (TypeScript) Frontend

## Prerequisites

1. **Meta Developer Account** - https://developers.facebook.com/
2. **WhatsApp Business Account** - Linked to your Meta Developer account
3. **Railway Account** - https://railway.app/
4. **Grok API Key** - https://x.ai/api (for AI responses)
5. **Google Cloud Project** - For Google Sheets and Calendar integration

---

## Project Structure

```
karuna-bot/
├── backend/                 # Python FastAPI backend
│   ├── app/
│   │   ├── main.py         # FastAPI application
│   │   ├── config.py       # Settings and configuration
│   │   ├── routers/        # API endpoints
│   │   ├── services/       # Business logic
│   │   └── models/         # Pydantic schemas
│   └── requirements.txt
├── frontend/               # React TypeScript frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # API client
│   │   └── types/          # TypeScript types
│   └── package.json
├── Dockerfile              # Multi-stage build
├── docker-compose.yml      # Local development
└── railway.toml            # Railway configuration
```

---

## Step 1: Meta WhatsApp Business API Setup

### 1.1 Create Meta App

1. Go to [Meta Developer Portal](https://developers.facebook.com/)
2. Click "My Apps" -> "Create App"
3. Select "Business" as app type
4. Add "WhatsApp" product to your app

### 1.2 Get API Credentials

In your Meta App Dashboard, go to **WhatsApp -> API Setup**:

1. **Phone Number ID**: Copy the numeric ID shown under your phone number
2. **Access Token**: Click "Generate" to create a permanent token
   - For production, create a System User in Business Settings
   - Assign the System User to your app
   - Generate a permanent token for the System User

### 1.3 Configure App Settings

1. Go to **App Settings -> Basic**
2. Add **Privacy Policy URL**: `https://YOUR_RAILWAY_URL/privacy`
3. Add **Terms of Service URL**: `https://YOUR_RAILWAY_URL/terms`
4. Add your **App Domain**: `YOUR_RAILWAY_URL.railway.app`

### 1.4 Configure Webhook (After Railway Deployment)

You'll need your Railway URL first. After deploying, return here to complete this step:

1. Go to **WhatsApp -> Configuration -> Webhook**
2. Click "Edit" and enter:
   - **Callback URL**: `https://YOUR_RAILWAY_URL.railway.app/webhook`
   - **Verify Token**: Use the same value as your `META_VERIFY_TOKEN` env var
3. Subscribe to these webhook fields:
   - `messages`
   - `message_deliveries`
   - `message_reads`

---

## Step 2: Railway Deployment

### 2.1 Connect Repository

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project" -> "Deploy from GitHub repo"
3. Select your repository
4. Railway will automatically detect the Dockerfile

### 2.2 Configure Environment Variables

In Railway, go to your project -> "Variables" tab and add:

```env
# Required - Meta WhatsApp API
META_JWT_TOKEN=your_meta_access_token
META_NUMBER_ID=your_phone_number_id
META_VERIFY_TOKEN=your_custom_webhook_verify_token
META_VERSION=v21.0

# Required - Grok AI
XAI_API_KEY=your_xai_api_key

# Required - Google Services
GOOGLE_SHEET_ID=your_google_sheet_id
GOOGLE_CREDENTIALS_PATH=./google-credentials.json
MEET_LINK=https://meet.google.com/your-link
KARUNA_EMAIL=your@email.com

# Server Config
PORT=3008
ENVIRONMENT=production
```

### 2.3 Add Google Credentials

For Google Sheets and Calendar integration:

**Option 1: Using Railway Volume**
1. Create a volume in Railway
2. Upload `google-credentials.json` to the volume
3. Mount at `/app/google-credentials.json`

**Option 2: Base64 Environment Variable**
1. Base64 encode your credentials: `base64 -i google-credentials.json`
2. Add as `GOOGLE_CREDENTIALS_BASE64` env var
3. Modify the code to decode at runtime

### 2.4 Deploy

1. Railway will automatically deploy when you push to your main branch
2. Click "Deploy" or push to trigger a deployment
3. Wait for the build to complete (multi-stage Docker build)

### 2.5 Get Your Railway URL

1. Go to Settings -> Domains
2. Click "Generate Domain" to get a public URL
3. Your bot will be available at: `https://your-app.railway.app`

---

## Step 3: Complete Webhook Setup

Now that you have your Railway URL, go back to Meta Developer Portal:

1. **WhatsApp -> Configuration -> Webhook**
2. Enter Callback URL: `https://your-app.railway.app/webhook`
3. Enter your `META_VERIFY_TOKEN` value
4. Click "Verify and Save"
5. Subscribe to webhook fields: `messages`, `message_deliveries`, `message_reads`

---

## Step 4: Test Your Bot

1. **Admin Panel**: Visit `https://your-app.railway.app/`
2. **API Docs**: Visit `https://your-app.railway.app/docs`
3. **Health Check**: Visit `https://your-app.railway.app/health`
4. **Send Test Message**: Send a WhatsApp message to your business number

---

## Local Development

### Backend Only
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 3008
```

### Frontend Only
```bash
cd frontend
npm install
npm run dev
```

### Full Stack with Docker
```bash
docker-compose up --build
```

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `META_JWT_TOKEN` | Yes | Meta API Access Token |
| `META_NUMBER_ID` | Yes | WhatsApp Phone Number ID |
| `META_VERIFY_TOKEN` | Yes | Custom webhook verification token |
| `META_VERSION` | No | Graph API version (default: v21.0) |
| `XAI_API_KEY` | Yes | Grok AI API Key |
| `GOOGLE_SHEET_ID` | Yes | Google Sheet ID for appointments |
| `GOOGLE_CREDENTIALS_PATH` | No | Path to Google credentials (default: ./google-credentials.json) |
| `MEET_LINK` | Yes | Google Meet link for consultations |
| `KARUNA_EMAIL` | Yes | Organizer email for calendar events |
| `PORT` | No | Server port (default: 3008) |
| `ENVIRONMENT` | No | Environment (production/development) |
| `FRONTEND_URL` | No | Frontend URL for CORS |
| `CONFIG_FILE_PATH` | No | Config file path (default: ./config/bot-config.json) |

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/docs` | GET | API documentation (Swagger) |
| `/webhook` | GET/POST | Meta WhatsApp webhook |
| `/api/connection-status` | GET | Connection status |
| `/api/blacklist` | GET | Get blacklist |
| `/api/blacklist/add` | POST | Add to blacklist |
| `/api/blacklist/remove` | POST | Remove from blacklist |
| `/api/prompt` | GET/POST | Get/Update system prompt |
| `/api/flows` | GET/POST | List/Create flows |
| `/api/flows/{id}` | GET/PUT/DELETE | Flow CRUD |
| `/api/flow/activate` | POST | Activate a flow |
| `/v1/messages` | POST | Send WhatsApp message |
| `/privacy` | GET | Privacy policy page |
| `/terms` | GET | Terms of service page |

---

## Troubleshooting

### Bot not receiving messages

1. Check webhook configuration in Meta Developer Portal
2. Verify `META_VERIFY_TOKEN` matches your env var
3. Check Railway logs: `railway logs`

### Webhook verification failing

1. Ensure your app is deployed and running
2. Check the `/webhook` endpoint is accessible
3. Verify the token matches exactly

### API Errors

1. Check `META_JWT_TOKEN` is valid and not expired
2. Verify `META_NUMBER_ID` is correct
3. Check Railway logs for detailed error messages

### Frontend not loading

1. Check if the Docker build completed successfully
2. Verify frontend assets are in `/frontend/dist`
3. Check for JavaScript errors in browser console

---

## Monitoring

### Railway Dashboard

- View real-time logs
- Monitor CPU and memory usage
- Check deployment status

### Health Endpoint

```bash
curl https://your-app.railway.app/health
```

### Admin Panel

Access at `https://your-app.railway.app/` to:
- View connection status
- Manage blacklist
- Configure bot modes (flows)
- Edit system prompts

---

## Updating the Bot

1. Push changes to your GitHub repository
2. Railway will automatically redeploy
3. Monitor the deployment in Railway dashboard

---

## Security Best Practices

1. Never commit `.env` files or credentials to git
2. Use Railway's environment variables for all secrets
3. Regularly rotate your Meta API tokens
4. Keep `META_VERIFY_TOKEN` secret and unique
5. Use HTTPS only (Railway provides this automatically)

---

## Support

For issues with:
- **Meta API**: [Meta Developer Documentation](https://developers.facebook.com/docs/whatsapp)
- **Railway**: [Railway Documentation](https://docs.railway.app/)
- **FastAPI**: [FastAPI Documentation](https://fastapi.tiangolo.com/)
- **React**: [React Documentation](https://react.dev/)
