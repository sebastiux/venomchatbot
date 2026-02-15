/**
 * Karuna Bot - BuilderBot with Meta Provider + Grok AI
 *
 * Uses @builderbot/provider-meta for WhatsApp connection (proven to work)
 * and xAI Grok for AI-powered responses.
 */
import { createBot, createProvider, createFlow, addKeyword, EVENTS } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { MetaProvider as Provider } from '@builderbot/provider-meta'
import 'dotenv/config'

import { grokService } from './services/grokService.js'
import { configService } from './services/configService.js'

const PORT = process.env.PORT ?? 3008
const START_TIME = Date.now()

// ============= HELPER =============

function jsonResponse(res: any, data: any, status = 200) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    })
    return res.end(JSON.stringify(data))
}

function parseBody(req: any): Promise<any> {
    return new Promise((resolve) => {
        // If body is already parsed (by BuilderBot middleware)
        if (req.body && typeof req.body === 'object') {
            resolve(req.body)
            return
        }
        let body = ''
        req.on('data', (chunk: any) => (body += chunk))
        req.on('end', () => {
            try {
                resolve(JSON.parse(body))
            } catch {
                resolve({})
            }
        })
    })
}

// ============= BUILDERBOT FLOWS =============

/**
 * Reset flow - clear conversation history
 */
const resetFlow = addKeyword<Provider, Database>(['reset', 'reiniciar', 'limpiar'])
    .addAction(async (ctx, { flowDynamic }) => {
        grokService.clearConversation(ctx.from)
        await flowDynamic('Conversacion reiniciada. Como puedo ayudarte?')
    })

/**
 * Main AI flow - catches all messages not matched by other flows.
 * Sends to Grok AI for intelligent responses.
 */
const aiFlow = addKeyword<Provider, Database>(EVENTS.WELCOME)
    .addAction(async (ctx, { flowDynamic }) => {
        const from = ctx.from
        const text = ctx.body

        console.log(`\n${'='.repeat(50)}`)
        console.log(`Message from ${from}: ${text}`)

        // Check blacklist
        if (configService.isBlacklisted(from)) {
            console.log(`SKIP - Number ${from} is blacklisted`)
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

        await flowDynamic(response)
    })

// ============= MAIN =============

const main = async () => {
    const adapterFlow = createFlow([resetFlow, aiFlow])

    const adapterProvider = createProvider(Provider, {
        jwtToken: process.env.JWT_TOKEN || process.env.META_JWT_TOKEN || '',
        numberId: process.env.NUMBER_ID || process.env.META_NUMBER_ID || '',
        verifyToken: process.env.VERIFY_TOKEN || process.env.META_VERIFY_TOKEN || '',
        version: process.env.VERSION || process.env.META_VERSION || 'v22.0',
    })

    const adapterDB = new Database()

    const { handleCtx, httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })

    // ============= API ENDPOINTS =============

    const server = adapterProvider.server

    // --- CORS preflight ---
    server.options('/*', (_req: any, res: any) => {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        })
        res.end()
    })

    // --- Health ---
    server.get('/health', (_req: any, res: any) => {
        jsonResponse(res, {
            status: 'ok',
            uptime: (Date.now() - START_TIME) / 1000,
            timestamp: new Date().toISOString(),
        })
    })

    // --- Connection Status ---
    server.get('/api/connection-status', (_req: any, res: any) => {
        const numberId = process.env.NUMBER_ID || process.env.META_NUMBER_ID || ''
        jsonResponse(res, {
            status: 'connected',
            provider: 'meta',
            error: null,
            number_id: numberId ? `...${numberId.slice(-4)}` : null,
            timestamp: new Date().toISOString(),
        })
    })

    // --- Blacklist ---
    server.get('/api/blacklist', (_req: any, res: any) => {
        const blacklist = configService.getBlacklist()
        jsonResponse(res, { blacklist, count: blacklist.length })
    })

    server.post(
        '/api/blacklist/add',
        handleCtx(async (bot, req, res) => {
            const body = await parseBody(req)
            const number = body.number
            if (number) {
                configService.addToBlacklist(number)
                bot.blacklist.add(number)
            }
            const blacklist = configService.getBlacklist()
            jsonResponse(res, { status: 'added', number, blacklist })
        })
    )

    server.post(
        '/api/blacklist/remove',
        handleCtx(async (bot, req, res) => {
            const body = await parseBody(req)
            const number = body.number
            if (number) {
                configService.removeFromBlacklist(number)
                bot.blacklist.remove(number)
            }
            const blacklist = configService.getBlacklist()
            jsonResponse(res, { status: 'removed', number, blacklist })
        })
    )

    // --- Prompt ---
    server.get('/api/prompt', (_req: any, res: any) => {
        jsonResponse(res, {
            prompt: configService.getSystemPrompt(),
            current_flow: configService.getCurrentFlow(),
        })
    })

    server.post('/api/prompt', async (req: any, res: any) => {
        const body = await parseBody(req)
        if (body.prompt) {
            configService.updateSystemPrompt(body.prompt)
        }
        jsonResponse(res, { status: 'updated', prompt: body.prompt })
    })

    // --- Flows ---
    server.get('/api/flows', (_req: any, res: any) => {
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

        jsonResponse(res, { flows, current_flow: currentFlow })
    })

    server.post('/api/flow/activate', async (req: any, res: any) => {
        const body = await parseBody(req)
        const flowId = body.flow_id
        const flowData = configService.getFlowData(flowId)

        if (!flowData) {
            return jsonResponse(res, { error: 'Flow not found' }, 404)
        }

        configService.setFlow(flowId)
        jsonResponse(res, {
            status: 'activated',
            flow_id: flowId,
            flow_name: flowData.name || flowId,
        })
    })

    server.post('/api/flows', async (req: any, res: any) => {
        const body = await parseBody(req)
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
            return jsonResponse(res, { error: result.message }, 400)
        }
        jsonResponse(res, { status: 'created', flow_id: body.id })
    })

    // --- Send Message (from frontend) ---
    server.post(
        '/v1/messages',
        handleCtx(async (_bot, req, res) => {
            const body = await parseBody(req)
            const { number, message } = body

            if (!number || !message) {
                return jsonResponse(res, { error: 'number and message required' }, 400)
            }

            try {
                await adapterProvider.sendText(number, message)
                jsonResponse(res, { status: 'sent', number })
            } catch (error: any) {
                console.error('Error sending message:', error)
                jsonResponse(res, { status: 'error', error: error.message }, 500)
            }
        })
    )

    // --- Blacklist via BuilderBot convention ---
    server.post(
        '/v1/blacklist',
        handleCtx(async (bot, req, res) => {
            const { number, intent } = req.body
            if (intent === 'remove') bot.blacklist.remove(number)
            if (intent === 'add') bot.blacklist.add(number)
            jsonResponse(res, { status: 'ok', number, intent })
        })
    )

    // ============= START SERVER =============

    httpServer(+PORT)

    console.log('='.repeat(60))
    console.log('  KARUNA BOT v3.0.0 (BuilderBot + Grok AI)')
    console.log('='.repeat(60))
    console.log()
    console.log('  META WHATSAPP:')
    console.log(`    Provider: @builderbot/provider-meta`)
    const numberId = process.env.NUMBER_ID || process.env.META_NUMBER_ID || ''
    console.log(`    Number ID: ...${numberId.slice(-4) || 'NOT SET'}`)
    console.log(`    Version: ${process.env.VERSION || process.env.META_VERSION || 'v22.0'}`)
    console.log()
    console.log('  AI:')
    console.log(`    Grok AI: ${process.env.XAI_API_KEY ? 'OK' : 'NOT CONFIGURED'}`)
    console.log()
    console.log(`  SERVER:`)
    console.log(`    Port: ${PORT}`)
    console.log(`    API Docs: http://localhost:${PORT}/health`)
    console.log()
    console.log('='.repeat(60))
}

main().catch(console.error)
