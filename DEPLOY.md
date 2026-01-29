# Karuna Bot - Railway Deployment Guide

This guide will help you deploy the Karuna WhatsApp Bot to Railway using the Meta WhatsApp Business API.

## Prerequisites

1. **Meta Developer Account** - https://developers.facebook.com/
2. **WhatsApp Business Account** - Linked to your Meta Developer account
3. **Railway Account** - https://railway.app/
4. **Grok API Key** - https://x.ai/api (for AI responses)
5. **Google Cloud Project** - For Google Sheets and Calendar integration

---

## Step 1: Meta WhatsApp Business API Setup

### 1.1 Create Meta App

1. Go to [Meta Developer Portal](https://developers.facebook.com/)
2. Click "My Apps" → "Create App"
3. Select "Business" as app type
4. Add "WhatsApp" product to your app

### 1.2 Get API Credentials

In your Meta App Dashboard, go to **WhatsApp → API Setup**:

1. **Phone Number ID**: Copy the numeric ID shown under your phone number
2. **Access Token**: Click "Generate" to create a permanent token
   - For production, create a System User in Business Settings
   - Assign the System User to your app
   - Generate a permanent token for the System User

### 1.3 Configure Webhook (After Railway Deployment)

You'll need your Railway URL first. After deploying, return here to complete this step:

1. Go to **WhatsApp → Configuration → Webhook**
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
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway will automatically detect the Dockerfile

### 2.2 Configure Environment Variables

In Railway, go to your project → "Variables" tab and add:

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
MEET_LINK=https://meet.google.com/your-link
KARUNA_EMAIL=your@email.com

# Optional
PORT=3008
NODE_ENV=production
```

### 2.3 Add Google Credentials

For Google Sheets and Calendar integration, you need to add your service account credentials:

1. In Railway, go to your project settings
2. Create a new volume or use environment variable for the credentials
3. Alternatively, base64 encode your `google-credentials.json` and use it as an env var

### 2.4 Deploy

1. Railway will automatically deploy when you push to your main branch
2. Click "Deploy" or push to trigger a deployment
3. Wait for the build to complete

### 2.5 Get Your Railway URL

1. Go to Settings → Domains
2. Click "Generate Domain" to get a public URL
3. Your bot will be available at: `https://your-app.railway.app`

---

## Step 3: Complete Webhook Setup

Now that you have your Railway URL, go back to Meta Developer Portal:

1. **WhatsApp → Configuration → Webhook**
2. Enter Callback URL: `https://your-app.railway.app/webhook`
3. Enter your `META_VERIFY_TOKEN` value
4. Click "Verify and Save"
5. Subscribe to webhook fields: `messages`, `message_deliveries`, `message_reads`

---

## Step 4: Test Your Bot

1. **Admin Panel**: Visit `https://your-app.railway.app/admin.html`
2. **Health Check**: Visit `https://your-app.railway.app/health`
3. **Send Test Message**: Send a WhatsApp message to your business number

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
| `MEET_LINK` | Yes | Google Meet link for consultations |
| `KARUNA_EMAIL` | Yes | Organizer email for calendar events |
| `PORT` | No | Server port (default: 3008) |
| `NODE_ENV` | No | Environment (production/development) |

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

### Connection Status showing "Error"

1. Verify all Meta credentials are correct
2. Check the admin panel at `/admin.html`
3. Review Railway deployment logs

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

Access at `https://your-app.railway.app/admin.html` to:
- View connection status
- Manage blacklist
- Configure bot modes
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

---

## Support

For issues with:
- **Meta API**: [Meta Developer Documentation](https://developers.facebook.com/docs/whatsapp)
- **Railway**: [Railway Documentation](https://docs.railway.app/)
- **BuilderBot**: [BuilderBot Documentation](https://builderbot.app/)
