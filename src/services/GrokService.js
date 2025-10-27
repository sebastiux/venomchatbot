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

    this.systemPrompt = configService.getSystemPrompt();
    this.conversations = {};
    this.userMenuState = {}; // Track if user has seen menu
    console.log('✅ GrokService inicializado correctamente\n');
  }

  updateSystemPrompt(newPrompt) {
    this.systemPrompt = newPrompt;
    console.log('✅ System prompt actualizado en GrokService');
  }

  shouldShowMenu(userId) {
    const currentFlow = configService.getCurrentFlow();
    const flowData = configService.getFlowData(currentFlow);
    
    // Show menu if: flow has menu, and user hasn't seen it yet
    if (flowData && flowData.hasMenu && flowData.menuConfig) {
      if (!this.userMenuState[userId]) {
        return true;
      }
    }
    return false;
  }

  buildMenuMessage(menuConfig) {
    let message = menuConfig.welcomeMessage + '\n\n';
    
    menuConfig.options.forEach((option, index) => {
      message += `${index + 1}. ${option.label}\n`;
    });
    
    message += '\n' + menuConfig.footerMessage;
    return message;
  }

  handleMenuSelection(userId, userMessage, menuConfig) {
    const selection = parseInt(userMessage.trim());
    
    if (isNaN(selection) || selection < 1 || selection > menuConfig.options.length) {
      return null;
    }
    
    const selectedOption = menuConfig.options[selection - 1];
    return selectedOption.response;
  }

  async getResponse(userId, userMessage) {
    console.log('\n📨 Nueva solicitud a Grok:');
    console.log('  Usuario:', userId);
    console.log('  Mensaje:', userMessage);
    
    try {
      // Check if we should show menu
      if (this.shouldShowMenu(userId)) {
        const currentFlow = configService.getCurrentFlow();
        const menuConfig = configService.getMenuForFlow(currentFlow);
        
        if (menuConfig) {
          this.userMenuState[userId] = true;
          return this.buildMenuMessage(menuConfig);
        }
      }

      // Check if this is a menu selection
      const currentFlow = configService.getCurrentFlow();
      const flowData = configService.getFlowData(currentFlow);
      
      if (flowData && flowData.hasMenu && flowData.menuConfig) {
        const menuResponse = this.handleMenuSelection(userId, userMessage, flowData.menuConfig);
        if (menuResponse) {
          console.log('  📋 Respuesta de menú seleccionada');
          return menuResponse;
        }
      }

      // Normal AI response
      if (!this.conversations[userId]) {
        this.conversations[userId] = [];
        console.log('  📝 Nueva conversación creada');
      }

      this.conversations[userId].push({
        role: 'user',
        content: userMessage
      });

      if (this.conversations[userId].length > 20) {
        this.conversations[userId] = this.conversations[userId].slice(-20);
        console.log('  ♻️  Historial recortado a 20 mensajes');
      }

      console.log('  📤 Enviando a Grok API...');
      console.log('  🤖 Modelo: grok-4-fast-reasoning');
      console.log('  💬 Mensajes en contexto:', this.conversations[userId].length);

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
      
      return 'Disculpa, hubo un error técnico. ¿Puedes intentar de nuevo?';
    }
  }

  clearConversation(userId) {
    this.conversations[userId] = [];
    this.userMenuState[userId] = false;
    console.log('🔄 Conversación reiniciada para:', userId);
  }

  getConversationHistory(userId) {
    return this.conversations[userId] || [];
  }
}

export default new GrokService();