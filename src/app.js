import { createBot, createProvider, createFlow, addKeyword, utils } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'

const PORT = process.env.PORT ?? 3008

const servicesFlow = addKeyword(['servicios', 'services', '1'])
    .addAnswer([
        '🔧 *Nuestros Servicios de Consultoría TI:*',
        '',
        '1️⃣ Desarrollo de Software a Medida',
        '2️⃣ Consultoría Cloud (AWS, Azure, GCP)',
        '3️⃣ Transformación Digital',
        '4️⃣ Ciberseguridad y Auditorías',
        '5️⃣ DevOps e Infraestructura',
        '6️⃣ Inteligencia Artificial y Automatización',
        '',
        'Escribe el *número* del servicio que te interesa o *contacto* para hablar con un asesor'
    ].join('\n'))

const contactFlow = addKeyword(['contacto', 'contact', '2', 'asesor', 'hablar'])
    .addAnswer('📞 *Información de Contacto - Karuna*')
    .addAnswer([
        '📧 Email: info@karuna.com',
        '📱 WhatsApp: +52 55 1234 5678',
        '🌐 Web: www.karuna.com',
        '📍 Ubicación: Ciudad de México',
        '',
        '⏰ Horario de atención:',
        'Lunes a Viernes: 9:00 - 18:00 hrs'
    ].join('\n'))
    .addAnswer(
        '¿Te gustaría agendar una *consulta gratuita*? (Sí/No)',
        { capture: true },
        async (ctx, { flowDynamic, gotoFlow }) => {
            if (ctx.body.toLowerCase().includes('si') || ctx.body.toLowerCase().includes('sí')) {
                return gotoFlow(scheduleFlow)
            }
            await flowDynamic('¡Perfecto! Estamos aquí cuando nos necesites. 😊')
        }
    )

const scheduleFlow = addKeyword(utils.setEvent('SCHEDULE_FLOW'))
    .addAnswer('📅 *Agendamiento de Consulta Gratuita*')
    .addAnswer(
        '¿Cuál es tu nombre completo?',
        { capture: true },
        async (ctx, { state }) => {
            await state.update({ name: ctx.body })
        }
    )
    .addAnswer(
        '¿Cuál es tu empresa?',
        { capture: true },
        async (ctx, { state }) => {
            await state.update({ company: ctx.body })
        }
    )
    .addAnswer(
        '¿Qué servicio te interesa?',
        { capture: true },
        async (ctx, { state }) => {
            await state.update({ service: ctx.body })
        }
    )
    .addAnswer(
        '¿Cuál es tu email corporativo?',
        { capture: true },
        async (ctx, { state }) => {
            await state.update({ email: ctx.body })
        }
    )
    .addAction(async (_, { flowDynamic, state }) => {
        await flowDynamic([
            '✅ *¡Registro Exitoso!*',
            '',
            `Nombre: ${state.get('name')}`,
            `Empresa: ${state.get('company')}`,
            `Servicio: ${state.get('service')}`,
            `Email: ${state.get('email')}`,
            '',
            'Uno de nuestros consultores se pondrá en contacto contigo en las próximas 24 horas para coordinar la consulta.',
            '',
            '¡Gracias por confiar en Karuna! 🙏'
        ].join('\n'))
    })

const casesFlow = addKeyword(['casos', 'proyectos', 'portfolio', '3'])
    .addAnswer([
        '🏆 *Casos de Éxito - Karuna*',
        '',
        '✨ Banco XYZ - Transformación Digital',
        '   Reducción de 40% en tiempos de proceso',
        '',
        '✨ Retail ABC - E-commerce Cloud',
        '   Incremento de 300% en ventas online',
        '',
        '✨ Corporativo DEF - Ciberseguridad',
        '   Zero incidentes en 2 años',
        '',
        'Escribe *contacto* para conocer más detalles'
    ].join('\n'))

const welcomeFlow = addKeyword(['hola', 'hi', 'hello', 'buenos dias', 'buenas tardes', 'menu'])
    .addAnswer('👋 ¡Hola! Bienvenido a *Karuna*')
    .addAnswer([
        '💼 Somos tu socio estratégico en consultoría TI',
        '',
        'Transformamos ideas en soluciones tecnológicas innovadoras.',
        '',
        '¿En qué podemos ayudarte hoy?',
        '',
        '1️⃣ Conocer nuestros *servicios*',
        '2️⃣ Información de *contacto*',
        '3️⃣ Ver *casos* de éxito',
        '',
        'Escribe el número o la palabra clave'
    ].join('\n'),
    null,
    null,
    [servicesFlow, contactFlow, casesFlow]
)

const main = async () => {
    const adapterFlow = createFlow([
        welcomeFlow, 
        servicesFlow, 
        contactFlow, 
        scheduleFlow, 
        casesFlow
    ])
    
    const adapterProvider = createProvider(Provider)
    const adapterDB = new Database()

    const { handleCtx, httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })

    adapterProvider.server.post(
        '/v1/messages',
        handleCtx(async (bot, req, res) => {
            const { number, message, urlMedia } = req.body
            await bot.sendMessage(number, message, { media: urlMedia ?? null })
            return res.end('sended')
        })
    )

    adapterProvider.server.post(
        '/v1/blacklist',
        handleCtx(async (bot, req, res) => {
            const { number, intent } = req.body
            if (intent === 'remove') bot.blacklist.remove(number)
            if (intent === 'add') bot.blacklist.add(number)

            res.writeHead(200, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ status: 'ok', number, intent }))
        })
    )

    httpServer(+PORT)
    
    console.log('='.repeat(60))
    console.log(`🚀 KARUNA BOT iniciado en puerto ${PORT}`)
    console.log(`📱 Abre: http://localhost:${PORT}`)
    console.log(`📲 Escanea el QR con WhatsApp`)
    console.log('='.repeat(60))
}

main().catch(console.error)