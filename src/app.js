import { createBot, createProvider, createFlow, addKeyword, utils, EVENTS } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'
import grokService from './services/GrokService.js'
import configService from './services/ConfigService.js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PORT = process.env.PORT ?? 3008

const scheduleFlow = addKeyword(utils.setEvent('SCHEDULE_FLOW'))
    .addAnswer('📅 *Agendamiento de Consulta Gratuita*')
    .addAnswer('¿Cuál es tu nombre completo?', { capture: true }, async (ctx, { state }) => {
        await state.update({ name: ctx.body })
    })
    .addAnswer('¿Cuál es tu empresa?', { capture: true }, async (ctx, { state }) => {
        await state.update({ company: ctx.body })
    })
    .addAnswer('¿Qué servicio te interesa?', { capture: true }, async (ctx, { state }) => {
        await state.update({ service: ctx.body })
    })
    .addAnswer('¿Cuál es tu email corporativo?', { capture: true }, async (ctx, { state }) => {
        await state.update({ email: ctx.body })
    })
    .addAction(async (_, { flowDynamic, state }) => {
        await flowDynamic([
            '✅ *¡Registro Exitoso!*',
            '',
            `Nombre: ${state.get('name')}`,
            `Empresa: ${state.get('company')}`,
            `Servicio: ${state.get('service')}`,
            `Email: ${state.get('email')}`,
            '',
            'Uno de nuestros consultores se pondrá en contacto contigo en las próximas 24 horas.',
            '',
            '¡Gracias por confiar en Karuna! 🙏'
        ].join('\n'))
    })

const welcomeFlow = addKeyword(['hola', 'hi', 'hello', 'buenos dias', 'buenas tardes', 'buenas noches'])
    .addAnswer('👋 ¡Hola! Bienvenido a *Karuna*')
    .addAnswer([
        '💼 Somos tu socio estratégico en consultoría TI',
        '',
        'Transformamos ideas en soluciones tecnológicas innovadoras.',
        '',
        '¿En qué te puedo ayudar hoy?'
    ].join('\n'))

const resetFlow = addKeyword(['reset', 'reiniciar', 'limpiar'])
    .addAction(async (ctx, { flowDynamic }) => {
        grokService.clearConversation(ctx.from)
        await flowDynamic('🔄 Conversación reiniciada.')
        await flowDynamic('¿En qué te puedo ayudar? 😊')
    })

const grokFlow = addKeyword(EVENTS.WELCOME)
    .addAction(async (ctx, { flowDynamic, endFlow }) => {
        // Ignorar mensajes de grupos
        if (ctx.from.includes('@g.us')) {
            console.log('⛔ Mensaje de grupo ignorado')
            return endFlow()
        }

        // Verificar blacklist
        if (configService.isBlacklisted(ctx.from)) {
            console.log(`🚫 Número en blacklist: ${ctx.from}`)
            return endFlow()
        }

        const msg = ctx.body.toLowerCase().trim()
        
        const saludos = ['hola', 'hi', 'hello', 'buenos dias', 'buenas tardes', 'buenas noches']
        const resets = ['reset', 'reiniciar', 'limpiar']
        
        if (saludos.includes(msg) || resets.includes(msg)) {
            return endFlow()
        }

        console.log('\n💬 Mensaje procesado por Grok')
        console.log('  Usuario:', ctx.pushName || ctx.from)
        console.log('  Mensaje:', ctx.body)
        
        //await flowDynamic('💭')
        
        try {
            const response = await grokService.getResponse(ctx.from, ctx.body)
            await flowDynamic(response)
            console.log('  ✅ Respuesta enviada\n')
        } catch (error) {
            console.error('  ❌ Error en Grok:', error)
            await flowDynamic('Disculpa, hubo un error técnico.')
        }
    })

// Estado global para QR y conexión
let currentQR = null;
let connectionStatus = 'disconnected'; // disconnected, qr, connecting, connected

const main = async () => {
    const adapterFlow = createFlow([
        welcomeFlow,
        resetFlow,
        scheduleFlow,
        grokFlow
    ])
    
    const adapterProvider = createProvider(Provider)
    const adapterDB = new Database()

    // Capturar eventos del proveedor
    adapterProvider.on('qr', (qr) => {
        currentQR = qr;
        connectionStatus = 'qr';
        console.log('📱 Nuevo QR generado - Disponible en el panel web');
    });

    adapterProvider.on('ready', () => {
        currentQR = null;
        connectionStatus = 'connected';
        console.log('✅ WhatsApp conectado exitosamente');
    });

    adapterProvider.on('auth_failure', () => {
        connectionStatus = 'disconnected';
        console.log('❌ Fallo de autenticación');
    });

    const { handleCtx, httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })

    // Servir archivos estáticos (interfaz web)
    const publicPath = path.join(__dirname, '../public')
    adapterProvider.server.use(express.static(publicPath))

    // Ruta principal - redirigir a admin
    adapterProvider.server.get('/', (req, res) => {
        res.redirect('/admin.html')
    })

    // ============= API ENDPOINTS =============

    // Endpoint para obtener QR y estado de conexión
    adapterProvider.server.get('/api/connection-status', handleCtx(async (bot, req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ 
            status: connectionStatus,
            qr: currentQR,
            timestamp: new Date().toISOString()
        }))
    }))

    // Endpoint para obtener blacklist
    adapterProvider.server.get('/api/blacklist', handleCtx(async (bot, req, res) => {
        const blacklist = configService.getBlacklist()
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: true, blacklist }))
    }))

    // Endpoint para agregar a blacklist
    adapterProvider.server.post('/api/blacklist/add', handleCtx(async (bot, req, res) => {
        const { number } = req.body
        
        if (!number) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ success: false, message: 'Número requerido' }))
        }

        const success = configService.addToBlacklist(number)
        
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ 
            success, 
            message: success ? 'Número agregado a blacklist' : 'El número ya está en la blacklist' 
        }))
    }))

    // Endpoint para remover de blacklist
    adapterProvider.server.post('/api/blacklist/remove', handleCtx(async (bot, req, res) => {
        const { number } = req.body
        
        if (!number) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ success: false, message: 'Número requerido' }))
        }

        configService.removeFromBlacklist(number)
        
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: true, message: 'Número removido de blacklist' }))
    }))

    // Endpoint para obtener system prompt
    adapterProvider.server.get('/api/prompt', handleCtx(async (bot, req, res) => {
        const systemPrompt = configService.getSystemPrompt()
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: true, systemPrompt }))
    }))

    // Endpoint para actualizar system prompt
    adapterProvider.server.post('/api/prompt', handleCtx(async (bot, req, res) => {
        const { systemPrompt } = req.body
        
        if (!systemPrompt) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ success: false, message: 'System prompt requerido' }))
        }

        const success = configService.updateSystemPrompt(systemPrompt)
        
        // Actualizar el prompt en GrokService
        grokService.updateSystemPrompt(systemPrompt)
        
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success, message: 'System prompt actualizado' }))
    }))

    // ============= FLOW ENDPOINTS =============

    // Endpoint para obtener todos los flows
    adapterProvider.server.get('/api/flows', handleCtx(async (bot, req, res) => {
        const currentFlow = configService.getCurrentFlow()
        const allFlows = configService.getAllFlows()
        
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ 
            success: true, 
            currentFlow,
            flows: allFlows
        }))
    }))

    // Endpoint para obtener un flow específico
    adapterProvider.server.get('/api/flows/:flowId', handleCtx(async (bot, req, res) => {
        const flowId = req.params.flowId
        const flowData = configService.getFlowData(flowId)
        
        if (flowData) {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ success: true, flow: flowData }))
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ success: false, message: 'Flow no encontrado' }))
        }
    }))

    // Endpoint para cambiar flow activo
    adapterProvider.server.post('/api/flow/activate', handleCtx(async (bot, req, res) => {
        const { flowId } = req.body
        
        if (!flowId) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ success: false, message: 'Flow ID requerido' }))
        }

        const success = configService.setFlow(flowId)
        
        if (success) {
            const newPrompt = configService.getSystemPrompt()
            grokService.updateSystemPrompt(newPrompt)
            
            res.writeHead(200, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ 
                success: true, 
                message: `Flow cambiado a ${flowId}` 
            }))
        } else {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ 
                success: false, 
                message: 'Flow inválido' 
            }))
        }
    }))

    // Endpoint para crear flow personalizado
    adapterProvider.server.post('/api/flows', handleCtx(async (bot, req, res) => {
        const { flowId, name, description, prompt, hasMenu, menuConfig } = req.body
        
        if (!flowId || !name || !prompt) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ 
                success: false, 
                message: 'flowId, name y prompt son requeridos' 
            }))
        }
        
        const result = configService.createCustomFlow(
            flowId, 
            name, 
            description || '', 
            prompt,
            hasMenu || false,
            menuConfig || null
        )
        
        res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify(result))
    }))

    // Endpoint para actualizar flow personalizado
    adapterProvider.server.put('/api/flows/:flowId', handleCtx(async (bot, req, res) => {
        const flowId = req.params.flowId
        const { name, description, prompt, hasMenu, menuConfig } = req.body
        
        if (!name || !prompt) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ 
                success: false, 
                message: 'name y prompt son requeridos' 
            }))
        }
        
        const result = configService.updateCustomFlow(
            flowId, 
            name, 
            description || '', 
            prompt,
            hasMenu || false,
            menuConfig || null
        )
        
        // Si es el flow actual, actualizar en GrokService
        if (result.success && configService.getCurrentFlow() === flowId) {
            grokService.updateSystemPrompt(prompt)
        }
        
        res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify(result))
    }))

    // Endpoint para eliminar flow personalizado
    adapterProvider.server.delete('/api/flows/:flowId', handleCtx(async (bot, req, res) => {
        const flowId = req.params.flowId
        const result = configService.deleteCustomFlow(flowId)
        
        // Si se eliminó el flow actual, actualizar GrokService con el nuevo prompt
        if (result.success) {
            const newPrompt = configService.getSystemPrompt()
            grokService.updateSystemPrompt(newPrompt)
        }
        
        res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify(result))
    }))

    // ============= LEGACY ENDPOINTS =============

    // Endpoint para enviar mensajes (legacy)
    adapterProvider.server.post('/v1/messages', handleCtx(async (bot, req, res) => {
        const { number, message, urlMedia } = req.body
        await bot.sendMessage(number, message, { media: urlMedia ?? null })
        return res.end('sended')
    }))

    // Endpoint para gestionar blacklist (legacy)
    adapterProvider.server.post('/v1/blacklist', handleCtx(async (bot, req, res) => {
        const { number, intent } = req.body
        if (intent === 'remove') configService.removeFromBlacklist(number)
        if (intent === 'add') configService.addToBlacklist(number)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ status: 'ok', number, intent }))
    }))

    httpServer(+PORT)
    
    console.log('='.repeat(60))
    console.log(`🚀 KARUNA BOT iniciado en puerto ${PORT}`)
    console.log(`🤖 Grok: ${process.env.XAI_API_KEY ? '✅ OK' : '❌ FALTA'}`)
    console.log(`🌐 Panel Admin: http://localhost:${PORT}/admin.html`)
    console.log('='.repeat(60))
}

main().catch(console.error)