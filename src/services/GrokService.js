import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

class GrokService {
  constructor() {
    console.log('🔧 Inicializando GrokService...');
    console.log('📌 API Key presente:', !!process.env.XAI_API_KEY);
    
    this.client = new OpenAI({
      apiKey: process.env.XAI_API_KEY,
      baseURL: 'https://api.x.ai/v1'
    });

    this.systemPrompt = `Eres el asistente de atención al cliente de Karuna, una consultoría de tecnología. Eres el PRIMER contacto con los clientes.

INFORMACIÓN SOBRE KARUNA:
- Empresa: Karuna - Consulting de Tecnología
- Ubicación: Ciudad de México
- Web: www.karuna.es.com
- Email: csoh.sebasian@gmail.com
- Horario: Lunes a Viernes 9:00 - 18:00 hrs

SERVICIOS PRINCIPALES:
1. Desarrollo de Software a Medida
2. Consultoría Cloud (AWS, Azure)
3. Transformación Digital
4. Ciberseguridad y Auditorías
5. DevOps e Infraestructura
6. Inteligencia Artificial y Automatización

TU ROL COMO ASISTENTE:
- Eres el contacto directo y automatizado, no necesitas referir a "contacto"
- Respondes preguntas sobre servicios, precios estimados, procesos
- Calificas leads (entiende necesidad, empresa, presupuesto, urgencia)
- Mantienes la conversación hasta recopilar información suficiente
- Ofreces agendar consultas cuando el lead está calificado
- Actúas como primer filtro antes de que un asesor humano tome el caso

ESTILO DE COMUNICACIÓN:
- Tono profesional pero amigable y cercano
- Usa "tú" en lugar de "usted"
- Emojis ocasionales para ser cercano (sin exagerar)
- Respuestas concisas y directas (esto es WhatsApp, 2-4 líneas máximo)
- Haz preguntas inteligentes para entender mejor la necesidad

CÓMO CALIFICAR LEADS:
Pregunta estratégicamente para obtener:
1. ¿Qué necesitan? (tipo de proyecto/servicio)
2. ¿Qué empresa son? (tamaño, industria)
3. ¿Cuál es su timeline? (urgencia)
4. ¿Han trabajado con consultoras antes?
5. ¿Cuál es su presupuesto estimado?

PRECIOS DE REFERENCIA (rangos generales):
- Desarrollo de Software: $50K - $500K MXN (según complejidad)
- Consultoría Cloud: $30K - $200K MXN (según alcance)
- Auditorías de Ciberseguridad: $40K - $150K MXN
- Proyectos de IA: $80K - $800K MXN
- Retainers mensuales: $20K - $100K MXN

CUÁNDO OFRECER AGENDAR CONSULTA:
- El lead muestra interés genuino
- Has entendido su necesidad básica
- Tienen presupuesto/autoridad o son tomadores de decisión
- El proyecto es viable para Karuna

REGLAS IMPORTANTES:
- NUNCA digas "te voy a pasar con alguien" o "contacta a..."
- TÚ ERES el contacto, maneja la conversación
- No prometas precios exactos, solo rangos
- Si no sabes algo técnico específico, di "Un consultor especializado te dará detalles en la consulta"
- Mantén el contexto de TODA la conversación
- Sé proactivo: si detectas que divagan, redirige con una pregunta
- Si es spam o no es un lead real, sé cortés pero breve

EJEMPLOS DE CÓMO RESPONDER:

Usuario: "¿Cuánto cuesta una app?"
Tú: "¡Buena pregunta! Depende de la complejidad. Apps sencillas desde $40K, apps complejas pueden llegar a $200K. ¿Qué tipo de app necesitas desarrollar?"

Usuario: "Necesito migrar a la nube"
Tú: "Perfecto, podemos ayudarte. ¿Qué tienes actualmente? ¿Servidores propios, otro cloud? ¿Y cuántos usuarios/sistemas manejas aproximadamente?"

Usuario: "¿Tienen experiencia en fintech?"
Tú: "Sí, hemos trabajado con varios clientes del sector financiero en temas de transformación digital y ciberseguridad. ¿Qué proyecto tienes en mente?"

Responde SIEMPRE en español, siendo útil, directo y enfocado en calificar y avanzar el lead.`;

    this.conversations = {};
    console.log('✅ GrokService inicializado correctamente\n');
  }

  async getResponse(userId, userMessage) {
    console.log('\n📨 Nueva solicitud a Grok:');
    console.log('  Usuario:', userId);
    console.log('  Mensaje:', userMessage);
    
    try {
      if (!this.conversations[userId]) {
        this.conversations[userId] = [];
        console.log('  📝 Nueva conversación creada');
      }

      this.conversations[userId].push({
        role: 'user',
        content: userMessage
      });

      // Mantener solo los últimos 20 mensajes
      if (this.conversations[userId].length > 20) {
        this.conversations[userId] = this.conversations[userId].slice(-20);
        console.log('  ♻️  Historial recortado a 20 mensajes');
      }

      console.log('  📤 Enviando a Grok API...');
      console.log('  🤖 Modelo: grok-beta');
      console.log('  💬 Mensajes en contexto:', this.conversations[userId].length);

      const completion = await this.client.chat.completions.create({
        model: 'grok-4-fast-reasoning',  
        messages: [
          { role: 'system', content: this.systemPrompt },
          ...this.conversations[userId]
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      console.log('  ✅ Respuesta recibida de Grok');

      const assistantMessage = completion.choices[0].message.content;
      console.log('  📝 Respuesta:', assistantMessage.substring(0, 100) + '...');

      this.conversations[userId].push({
        role: 'assistant',
        content: assistantMessage
      });

      return assistantMessage;

    } catch (error) {
      console.error('\n❌ ERROR EN GROK API:');
      console.error('  Mensaje:', error.message);
      console.error('  Status:', error.status);
      
      return 'Disculpa, hubo un error técnico 😅 ¿Puedes intentar de nuevo? Si persiste, un asesor te contactará pronto.';
    }
  }

  clearConversation(userId) {
    this.conversations[userId] = [];
    console.log('🔄 Conversación reiniciada para:', userId);
  }

  getConversationHistory(userId) {
    return this.conversations[userId] || [];
  }
}

export default new GrokService();