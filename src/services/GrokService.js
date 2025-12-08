import OpenAI from 'openai';
import dotenv from 'dotenv';
import configService from './ConfigService.js';
import libraryService from './LibraryService.js';

dotenv.config();

class GrokService {
  constructor() {
    console.log('Inicializando GrokService...');
    console.log('API Key presente:', !!process.env.XAI_API_KEY);

    this.client = new OpenAI({
      apiKey: process.env.XAI_API_KEY,
      baseURL: 'https://api.x.ai/v1'
    });

    this.systemPrompt = configService.getSystemPrompt();
    this.conversations = {};
    this.userMenuState = {}; // Track if user has seen menu
    this.activeDocumentSessions = {}; // Track active document-based sessions
    console.log('GrokService inicializado correctamente\n');
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
    console.log('Conversacion reiniciada para:', userId);
  }

  getConversationHistory(userId) {
    return this.conversations[userId] || [];
  }

  // ============= LIBRARY/DOCUMENT-BASED CHAT METHODS =============

  // Start a new chat session with a specific document context
  async startDocumentChat(sessionId, docId, userId) {
    const document = libraryService.getDocument(docId);
    if (!document) {
      return { success: false, message: 'Documento no encontrado' };
    }

    // Build the full context for this document
    const documentContext = libraryService.buildContextForDocument(docId);

    // Store the active session
    this.activeDocumentSessions[sessionId] = {
      docId,
      userId,
      documentContext,
      documentTitle: document.title,
      messages: []
    };

    console.log(`Sesion de documento iniciada: ${sessionId} para documento: ${docId}`);
    return {
      success: true,
      message: `Chat iniciado con el documento "${document.title}"`,
      sessionId,
      documentTitle: document.title
    };
  }

  // Get response for a document-based chat session
  async getDocumentResponse(sessionId, userMessage) {
    const session = this.activeDocumentSessions[sessionId];

    if (!session) {
      return { success: false, message: 'Sesion no encontrada. Inicia un chat primero.' };
    }

    console.log('\nNueva solicitud a Grok (documento):');
    console.log('  Sesion:', sessionId);
    console.log('  Documento:', session.documentTitle);
    console.log('  Mensaje:', userMessage);

    try {
      // Add user message to session
      session.messages.push({
        role: 'user',
        content: userMessage
      });

      // Keep last 20 messages for context
      if (session.messages.length > 20) {
        session.messages = session.messages.slice(-20);
      }

      // Build the system prompt with document context
      const basePrompt = configService.getSystemPrompt();
      const fullSystemPrompt = `${basePrompt}\n\n${session.documentContext}\n\n=== INSTRUCCIONES ===\nResponde las preguntas del usuario basandote en el contexto del documento proporcionado. Si la pregunta no esta relacionada con el documento, puedes responder de manera general pero siempre intenta relacionarlo con el contenido disponible.`;

      console.log('  Enviando a Grok API con contexto de documento...');

      const completion = await this.client.chat.completions.create({
        model: 'grok-4-fast-reasoning',
        messages: [
          { role: 'system', content: fullSystemPrompt },
          ...session.messages
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      const assistantMessage = completion.choices[0].message.content;
      console.log('  Respuesta recibida');

      // Add assistant response to session
      session.messages.push({
        role: 'assistant',
        content: assistantMessage
      });

      // Also save to persistent chat history
      libraryService.addMessageToSession(sessionId, 'user', userMessage);
      libraryService.addMessageToSession(sessionId, 'assistant', assistantMessage);

      return {
        success: true,
        response: assistantMessage,
        sessionId
      };

    } catch (error) {
      console.error('ERROR EN GROK API (documento):', error.message);
      return {
        success: false,
        response: 'Disculpa, hubo un error tecnico. Intenta de nuevo.',
        error: error.message
      };
    }
  }

  // Resume a previous document chat session
  async resumeDocumentChat(sessionId) {
    const persistedSession = libraryService.getSession(sessionId);

    if (!persistedSession) {
      return { success: false, message: 'Sesion no encontrada' };
    }

    const document = libraryService.getDocument(persistedSession.documentId);
    if (!document) {
      return { success: false, message: 'El documento asociado ya no existe' };
    }

    // Rebuild the session from persisted data
    const documentContext = libraryService.buildContextForDocument(persistedSession.documentId);

    this.activeDocumentSessions[sessionId] = {
      docId: persistedSession.documentId,
      userId: persistedSession.userId,
      documentContext,
      documentTitle: document.title,
      messages: persistedSession.messages.map(m => ({
        role: m.role,
        content: m.content
      }))
    };

    console.log(`Sesion de documento reanudada: ${sessionId}`);
    return {
      success: true,
      message: `Chat reanudado con "${document.title}"`,
      sessionId,
      documentTitle: document.title,
      messageCount: persistedSession.messages.length
    };
  }

  // End a document chat session
  endDocumentChat(sessionId) {
    if (this.activeDocumentSessions[sessionId]) {
      delete this.activeDocumentSessions[sessionId];
      console.log(`Sesion de documento terminada: ${sessionId}`);
      return { success: true };
    }
    return { success: false, message: 'Sesion no encontrada' };
  }

  // Get active document session info
  getActiveDocumentSession(sessionId) {
    return this.activeDocumentSessions[sessionId] || null;
  }
}

export default new GrokService();