import OpenAI from 'openai';
import dotenv from 'dotenv';
import configService from './ConfigService.js';

dotenv.config();

class GrokService {
  constructor() {
    console.log('🔧 Inicializando GrokService...');
    console.log('📌 API Key presente:', !!process.env.XAI_API_KEY);
    
    this.client = new OpenAI({
      apiKey: process.env.XAI_API_KEY,
      baseURL: 'https://api.x.ai/v1'
    });

    // Cargar el prompt desde la configuración
    this.systemPrompt = configService.getSystemPrompt();
    this.conversations = {};
    console.log('✅ GrokService inicializado correctamente\n');
  }

  updateSystemPrompt(newPrompt) {
    this.systemPrompt = newPrompt;
    console.log('✅ System prompt actualizado en GrokService');
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
      console.log('  🤖 Modelo: grok-4-fast-reasoning');
      console.log('  💬 Mensajes en contexto:', this.conversations[userId].length);

      // Usar el system prompt actualizado
      const currentPrompt = this.systemPrompt || configService.getSystemPrompt();

      const completion = await this.client.chat.completions.create({
        model: 'grok-4-fast-reasoning',  
        messages: [
          { role: 'system', content: currentPrompt },
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