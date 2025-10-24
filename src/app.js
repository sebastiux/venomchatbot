import { createBot, createProvider, createFlow, addKeyword, utils, EVENTS } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'
import grokService from './services/GrokService.js'
import dotenv from 'dotenv'

dotenv.config()

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
        if (ctx.from.includes('@g.us')) {
            console.log('⛔ Mensaje de grupo ignorado')
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
        
        await flowDynamic('💭')
        
        try {
            const response = await grokService.getResponse(ctx.from, ctx.body)
            await flowDynamic(response)
            console.log('  ✅ Respuesta enviada\n')
        } catch (error) {
            console.error('  ❌ Error en Grok:', error)
            await flowDynamic('Disculpa, hubo un error técnico.')
        }
    })

const main = async () => {
    const adapterFlow = createFlow([
        welcomeFlow,
        resetFlow,
        scheduleFlow,
        grokFlow
    ])
    
    const adapterProvider = createProvider(Provider)
    const adapterDB = new Database()

    const { handleCtx, httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })

    adapterProvider.server.post('/v1/messages', handleCtx(async (bot, req, res) => {
        const { number, message, urlMedia } = req.body
        await bot.sendMessage(number, message, { media: urlMedia ?? null })
        return res.end('sended')
    }))

    adapterProvider.server.post('/v1/blacklist', handleCtx(async (bot, req, res) => {
        const { number, intent } = req.body
        if (intent === 'remove') bot.blacklist.remove(number)
        if (intent === 'add') bot.blacklist.add(number)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ status: 'ok', number, intent }))
    }))

    httpServer(+PORT)
    
    console.log('='.repeat(60))
    console.log(`🚀 KARUNA BOT iniciado en puerto ${PORT}`)
    console.log(`🤖 Grok: ${process.env.XAI_API_KEY ? '✅ OK' : '❌ FALTA'}`)
    console.log('='.repeat(60))
}

main().catch(console.error)