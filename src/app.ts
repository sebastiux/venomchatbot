/**
 * Karuna Bot - Maytapi WhatsApp API + Grok AI
 *
 * Uses Maytapi REST API for WhatsApp messaging.
 * Receives messages via webhook, responds with Grok AI.
 *
 * No QR scanning needed locally — Maytapi handles the
 * WhatsApp connection in the cloud.
 */
import express from 'express'
import path from 'path'
import fs from 'fs'
import 'dotenv/config'

import { grokService } from './services/grokService.js'
import { configService } from './services/configService.js'
import { maytapiService, type WebhookPayload } from './services/maytapiService.js'

const PORT = process.env.PORT ?? 3008
const START_TIME = Date.now()

const RESET_KEYWORDS = ['reset', 'reiniciar', 'limpiar']

// ============= EXPRESS APP =============

const app = express()
app.use(express.json())

// CORS
app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    next()
})
app.options('*', (_req, res) => res.sendStatus(204))

// ============= MAYTAPI WEBHOOK =============

/**
 * Process an incoming WhatsApp message:
 * check reset keywords, blacklist, then get AI response and reply.
 */
async function handleIncomingMessage(from: string, text: string) {
    console.log(`\n${'='.repeat(50)}`)
    console.log(`Message from ${from}: ${text}`)

    // Check blacklist
    if (configService.isBlacklisted(from)) {
        console.log(`SKIP - Number ${from} is blacklisted`)
        return
    }

    // Check reset keywords
    const lower = text.trim().toLowerCase()
    if (RESET_KEYWORDS.includes(lower)) {
        grokService.clearConversation(from)
        await maytapiService.sendMessage(from, 'Conversacion reiniciada. Como puedo ayudarte?')
        console.log(`Conversation reset for ${from}`)
        console.log(`${'='.repeat(50)}\n`)
        return
    }

    // Get AI response
    console.log('Getting AI response from Grok...')
    let response = await grokService.getResponse(from, text)

    // Check for schedule trigger
    if (response.includes('TRIGGER_SCHEDULE')) {
        response = 'Me encantaria ayudarte a agendar una cita. Por favor proporcioname tu nombre completo.'
    }

    console.log(`Response: ${response.substring(0, 200)}`)
    console.log(`${'='.repeat(50)}\n`)

    await maytapiService.sendMessage(from, response)
}

/**
 * Maytapi webhook endpoint — receives all events from Maytapi.
 */
app.post('/webhook', async (req, res) => {
    const payload: WebhookPayload = req.body

    // Acknowledge immediately
    res.json({ success: true })

    try {
        console.log(`[WEBHOOK] type=${payload.type} fromMe=${payload.message?.fromMe} conversation=${payload.conversation} receiver=${payload.receiver} msgType=${payload.message?.type} text="${payload.message?.text?.substring(0, 50) || ''}"`)

        // Only process incoming text messages (not from ourselves)
        if (payload.message?.fromMe) return
        if (payload.type && payload.type !== 'message') return

        const text = payload.message?.text
        if (!text) return

        // Maytapi fields:
        //   "conversation" = chat ID of the sender (e.g. "number@c.us")
        //   "receiver"     = bot's own phone number (who received the webhook)
        //   "user.phone"   = sender's phone number
        const conversation = payload.conversation || payload.message?.chatId || ''
        const from = payload.user?.phone || conversation.split('@')[0]
        if (!from) return

        // Skip group messages (only handle private chats)
        if (conversation.endsWith('@g.us')) {
            console.log(`[WEBHOOK] Skipping group message from ${conversation}`)
            return
        }

        await handleIncomingMessage(from, text)
    } catch (err: any) {
        console.error('[WEBHOOK] Error processing message:', err.message)
    }
})

// ============= API ENDPOINTS =============

// --- Health ---
app.get('/health', async (_req, res) => {
    let maytapiStatus: any = null
    try {
        maytapiStatus = await maytapiService.getStatus()
    } catch {}

    res.json({
        status: 'ok',
        uptime: (Date.now() - START_TIME) / 1000,
        timestamp: new Date().toISOString(),
        provider: 'maytapi',
        maytapi_configured: maytapiService.isConfigured(),
        maytapi_status: maytapiStatus,
    })
})

// --- QR Code (from Maytapi) ---
app.get('/api/qr', async (_req, res) => {
    if (!maytapiService.isConfigured()) {
        return res.json({ qr: null, status: 'disconnected', error: 'Maytapi not configured' })
    }

    try {
        // First check if phone is already connected
        const statusData = await maytapiService.getStatus()
        const phoneStatus = statusData?.status || statusData
        if (phoneStatus?.loggedIn === true) {
            return res.json({ qr: null, status: 'connected' })
        }

        // Phone not connected — try to get QR
        const result = await maytapiService.getQrCode()
        if (result.success && result.qr) {
            return res.json({ qr: result.qr, status: 'qr_ready' })
        }
        return res.json({ qr: null, status: 'disconnected' })
    } catch (err: any) {
        return res.json({ qr: null, status: 'disconnected', error: err.message })
    }
})

// --- Connection Status ---
app.get('/api/connection-status', async (_req, res) => {
    if (!maytapiService.isConfigured()) {
        return res.json({
            status: 'disconnected',
            provider: 'maytapi',
            error: 'Maytapi credentials not configured',
            phone: null,
            qr_available: false,
            timestamp: new Date().toISOString(),
        })
    }

    try {
        const data = await maytapiService.getStatus()

        // Maytapi returns: { success: true, status: { loggedIn: true, isQr: false, ... } }
        const phoneStatus = data?.status || data
        const isConnected = phoneStatus?.loggedIn === true
        const isQr = phoneStatus?.isQr === true

        let connStatus: 'connected' | 'qr_ready' | 'disconnected' = 'disconnected'
        if (isConnected) connStatus = 'connected'
        else if (isQr) connStatus = 'qr_ready'

        return res.json({
            status: connStatus,
            provider: 'maytapi',
            error: null,
            phone: data?.number || phoneStatus?.number || null,
            qr_available: isQr,
            timestamp: new Date().toISOString(),
            maytapi_details: data,
        })
    } catch (err: any) {
        return res.json({
            status: 'disconnected',
            provider: 'maytapi',
            error: err.message,
            phone: null,
            qr_available: false,
            timestamp: new Date().toISOString(),
        })
    }
})

// --- Screen (Maytapi phone screen) ---
app.get('/api/screen', async (_req, res) => {
    try {
        const result = await maytapiService.getScreen()
        res.json(result)
    } catch (err: any) {
        res.status(500).json({ error: err.message })
    }
})

// --- List Phones ---
app.get('/api/phones', async (_req, res) => {
    try {
        const phones = await maytapiService.listPhones()
        res.json(phones)
    } catch (err: any) {
        res.status(500).json({ error: err.message })
    }
})

// --- Set Webhook ---
app.post('/api/set-webhook', async (req, res) => {
    const { url } = req.body
    if (!url) {
        return res.status(400).json({ error: 'url is required' })
    }
    try {
        const result = await maytapiService.setWebhook(url)
        res.json({ status: 'ok', result })
    } catch (err: any) {
        res.status(500).json({ error: err.message })
    }
})

// --- Blacklist ---
app.get('/api/blacklist', (_req, res) => {
    const blacklist = configService.getBlacklist()
    res.json({ blacklist, count: blacklist.length })
})

app.post('/api/blacklist/add', (req, res) => {
    const { number } = req.body
    if (number) {
        configService.addToBlacklist(number)
    }
    const blacklist = configService.getBlacklist()
    res.json({ status: 'added', number, blacklist })
})

app.post('/api/blacklist/remove', (req, res) => {
    const { number } = req.body
    if (number) {
        configService.removeFromBlacklist(number)
    }
    const blacklist = configService.getBlacklist()
    res.json({ status: 'removed', number, blacklist })
})

// --- Prompt ---
app.get('/api/prompt', (_req, res) => {
    res.json({
        prompt: configService.getSystemPrompt(),
        current_flow: configService.getCurrentFlow(),
    })
})

app.post('/api/prompt', (req, res) => {
    const { prompt } = req.body
    if (prompt) {
        configService.updateSystemPrompt(prompt)
    }
    res.json({ status: 'updated', prompt })
})

// --- Flows ---
app.get('/api/flows', (_req, res) => {
    const allFlows = configService.getAllFlows()
    const currentFlow = configService.getCurrentFlow()

    const flows = Object.entries(allFlows).map(([id, data]: [string, any]) => ({
        id,
        name: data.name || id,
        description: data.description || '',
        system_prompt: data.prompt || '',
        is_builtin: data.is_builtin || false,
        flow_type: data.has_menu ? 'menu' : 'intelligent',
        welcome_message: data.menu_config?.welcome_message || null,
        footer_message: data.menu_config?.footer_message || null,
        menu_options: data.menu_config?.options || null,
    }))

    res.json({ flows, current_flow: currentFlow })
})

app.post('/api/flow/activate', (req, res) => {
    const { flow_id } = req.body
    const flowData = configService.getFlowData(flow_id)

    if (!flowData) {
        return res.status(404).json({ error: 'Flow not found' })
    }

    configService.setFlow(flow_id)
    res.json({
        status: 'activated',
        flow_id,
        flow_name: flowData.name || flow_id,
    })
})

app.post('/api/flows', (req, res) => {
    const body = req.body
    let menuConfig = undefined
    if (body.flow_type === 'menu' && body.menu_options) {
        menuConfig = {
            welcome_message: body.welcome_message || '',
            footer_message: body.footer_message || '',
            options: body.menu_options,
        }
    }

    const result = configService.createCustomFlow(
        body.id,
        body.name,
        body.description,
        body.system_prompt,
        body.flow_type === 'menu',
        menuConfig
    )

    if (!result.success) {
        return res.status(400).json({ error: result.message })
    }
    res.json({ status: 'created', flow_id: body.id })
})

// --- Send Message (from dashboard / external) ---
app.post('/v1/messages', async (req, res) => {
    const { number, message } = req.body

    if (!number || !message) {
        return res.status(400).json({ error: 'number and message required' })
    }

    try {
        await maytapiService.sendMessage(number, message)
        res.json({ status: 'sent', number })
    } catch (error: any) {
        console.error('Error sending message:', error)
        res.status(500).json({ status: 'error', error: error.message })
    }
})

// ============= STATIC FRONTEND =============

const STATIC_DIR = path.join(process.cwd(), 'public')

// Serve static files if public/ exists
if (fs.existsSync(STATIC_DIR)) {
    app.use(express.static(STATIC_DIR))

    // SPA fallback — serve index.html for non-API routes
    app.get('*', (req, res) => {
        const urlPath = req.path
        if (urlPath.startsWith('/api/') || urlPath === '/health' || urlPath.startsWith('/v1/') || urlPath === '/webhook') {
            return res.status(404).json({ error: 'Not found' })
        }
        const indexFile = path.join(STATIC_DIR, 'index.html')
        if (fs.existsSync(indexFile)) {
            return res.sendFile(indexFile)
        }
        res.status(404).send('Not found')
    })
}

// ============= START SERVER =============

app.listen(+PORT, () => {
    console.log('='.repeat(60))
    console.log('  KARUNA BOT v4.0.0 (Maytapi WhatsApp API + Grok AI)')
    console.log('='.repeat(60))
    console.log()
    console.log('  WHATSAPP:')
    console.log(`    Provider: Maytapi REST API`)
    console.log(`    Configured: ${maytapiService.isConfigured() ? 'YES' : 'NO - set MAYTAPI_* env vars'}`)
    if (maytapiService.isConfigured()) {
        console.log(`    Product ID: ${maytapiService.getProductId()}`)
        console.log(`    Phone ID: ${maytapiService.getPhoneId()}`)
    }
    console.log()
    console.log('  AI:')
    console.log(`    Grok AI: ${process.env.XAI_API_KEY ? 'OK' : 'NOT CONFIGURED'}`)
    console.log()
    console.log('  SERVER:')
    console.log(`    Port: ${PORT}`)
    console.log(`    Dashboard: http://localhost:${PORT}`)
    console.log(`    Health: http://localhost:${PORT}/health`)
    console.log(`    Webhook: http://localhost:${PORT}/webhook`)
    console.log()
    console.log('  Configure your Maytapi webhook to point to:')
    console.log(`    https://<your-domain>/webhook`)
    console.log('='.repeat(60))
})
