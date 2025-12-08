import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LibraryService {
  constructor() {
    this.libraryPath = path.join(__dirname, '../../config/library.json');
    this.chatHistoryPath = path.join(__dirname, '../../config/chat-history.json');
    this.ensureFiles();
  }

  ensureFiles() {
    const configDir = path.dirname(this.libraryPath);

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Library file for documents
    if (!fs.existsSync(this.libraryPath)) {
      const defaultLibrary = {
        institutionContext: '',
        documents: {}
      };
      fs.writeFileSync(this.libraryPath, JSON.stringify(defaultLibrary, null, 2));
      console.log('Archivo de biblioteca creado');
    }

    // Chat history file for tracking conversations per document
    if (!fs.existsSync(this.chatHistoryPath)) {
      const defaultHistory = {
        sessions: {}
      };
      fs.writeFileSync(this.chatHistoryPath, JSON.stringify(defaultHistory, null, 2));
      console.log('Archivo de historial de chats creado');
    }
  }

  // ============= LIBRARY METHODS =============

  getLibrary() {
    try {
      const data = fs.readFileSync(this.libraryPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error al leer biblioteca:', error);
      return { institutionContext: '', documents: {} };
    }
  }

  saveLibrary(library) {
    try {
      fs.writeFileSync(this.libraryPath, JSON.stringify(library, null, 2));
      console.log('Biblioteca guardada');
      return true;
    } catch (error) {
      console.error('Error al guardar biblioteca:', error);
      return false;
    }
  }

  // ============= INSTITUTION CONTEXT =============

  getInstitutionContext() {
    const library = this.getLibrary();
    return library.institutionContext || '';
  }

  updateInstitutionContext(context) {
    const library = this.getLibrary();
    library.institutionContext = context;
    this.saveLibrary(library);
    console.log('Contexto de institucion actualizado');
    return true;
  }

  // ============= DOCUMENT METHODS =============

  getAllDocuments() {
    const library = this.getLibrary();
    return library.documents || {};
  }

  getDocument(docId) {
    const library = this.getLibrary();
    return library.documents[docId] || null;
  }

  createDocument(docId, title, content, description = '') {
    // Validate docId format
    if (!/^[a-z0-9_-]+$/.test(docId)) {
      return { success: false, message: 'El ID solo puede contener letras minusculas, numeros, guiones y guiones bajos' };
    }

    const library = this.getLibrary();

    if (library.documents[docId]) {
      return { success: false, message: 'Ya existe un documento con ese ID' };
    }

    library.documents[docId] = {
      id: docId,
      title,
      content,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.saveLibrary(library);
    console.log(`Documento creado: ${docId}`);
    return { success: true, message: 'Documento creado exitosamente', document: library.documents[docId] };
  }

  updateDocument(docId, title, content, description = '') {
    const library = this.getLibrary();

    if (!library.documents[docId]) {
      return { success: false, message: 'Documento no encontrado' };
    }

    library.documents[docId] = {
      ...library.documents[docId],
      title,
      content,
      description,
      updatedAt: new Date().toISOString()
    };

    this.saveLibrary(library);
    console.log(`Documento actualizado: ${docId}`);
    return { success: true, message: 'Documento actualizado exitosamente', document: library.documents[docId] };
  }

  deleteDocument(docId) {
    const library = this.getLibrary();

    if (!library.documents[docId]) {
      return { success: false, message: 'Documento no encontrado' };
    }

    delete library.documents[docId];
    this.saveLibrary(library);

    // Also clean up related chat sessions
    this.cleanupDocumentSessions(docId);

    console.log(`Documento eliminado: ${docId}`);
    return { success: true, message: 'Documento eliminado exitosamente' };
  }

  // ============= CHAT HISTORY METHODS =============

  getChatHistory() {
    try {
      const data = fs.readFileSync(this.chatHistoryPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error al leer historial de chats:', error);
      return { sessions: {} };
    }
  }

  saveChatHistory(history) {
    try {
      fs.writeFileSync(this.chatHistoryPath, JSON.stringify(history, null, 2));
      return true;
    } catch (error) {
      console.error('Error al guardar historial:', error);
      return false;
    }
  }

  // Create or get a chat session for a specific document
  createChatSession(docId, userId, sessionName = '') {
    const history = this.getChatHistory();
    const sessionId = `${docId}_${userId}_${Date.now()}`;

    const document = this.getDocument(docId);
    if (!document) {
      return { success: false, message: 'Documento no encontrado' };
    }

    history.sessions[sessionId] = {
      id: sessionId,
      documentId: docId,
      documentTitle: document.title,
      userId,
      name: sessionName || `Chat sobre ${document.title}`,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.saveChatHistory(history);
    return { success: true, sessionId, session: history.sessions[sessionId] };
  }

  // Get all sessions for a specific document
  getDocumentSessions(docId) {
    const history = this.getChatHistory();
    const sessions = [];

    Object.values(history.sessions).forEach(session => {
      if (session.documentId === docId) {
        // Include preview of last messages
        const lastMessages = session.messages.slice(-3);
        sessions.push({
          ...session,
          messageCount: session.messages.length,
          preview: lastMessages,
          lastMessage: session.messages.length > 0 ? session.messages[session.messages.length - 1] : null
        });
      }
    });

    // Sort by most recent
    sessions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return sessions;
  }

  // Get all sessions (for overview)
  getAllSessions() {
    const history = this.getChatHistory();
    const sessions = [];

    Object.values(history.sessions).forEach(session => {
      const lastMessages = session.messages.slice(-3);
      sessions.push({
        ...session,
        messageCount: session.messages.length,
        preview: lastMessages,
        lastMessage: session.messages.length > 0 ? session.messages[session.messages.length - 1] : null
      });
    });

    sessions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return sessions;
  }

  // Get a specific session
  getSession(sessionId) {
    const history = this.getChatHistory();
    return history.sessions[sessionId] || null;
  }

  // Add message to a session
  addMessageToSession(sessionId, role, content) {
    const history = this.getChatHistory();

    if (!history.sessions[sessionId]) {
      return { success: false, message: 'Sesion no encontrada' };
    }

    history.sessions[sessionId].messages.push({
      role,
      content,
      timestamp: new Date().toISOString()
    });
    history.sessions[sessionId].updatedAt = new Date().toISOString();

    this.saveChatHistory(history);
    return { success: true };
  }

  // Delete a session
  deleteSession(sessionId) {
    const history = this.getChatHistory();

    if (!history.sessions[sessionId]) {
      return { success: false, message: 'Sesion no encontrada' };
    }

    delete history.sessions[sessionId];
    this.saveChatHistory(history);
    return { success: true, message: 'Sesion eliminada' };
  }

  // Clean up sessions when a document is deleted
  cleanupDocumentSessions(docId) {
    const history = this.getChatHistory();

    Object.keys(history.sessions).forEach(sessionId => {
      if (history.sessions[sessionId].documentId === docId) {
        delete history.sessions[sessionId];
      }
    });

    this.saveChatHistory(history);
  }

  // ============= CONTEXT BUILDING =============

  // Build full context for AI including institution context and document context
  buildContextForDocument(docId) {
    const institutionContext = this.getInstitutionContext();
    const document = this.getDocument(docId);

    let fullContext = '';

    if (institutionContext) {
      fullContext += `=== CONTEXTO DE LA INSTITUCION ===\n${institutionContext}\n\n`;
    }

    if (document) {
      fullContext += `=== DOCUMENTO: ${document.title} ===\n`;
      if (document.description) {
        fullContext += `Descripcion: ${document.description}\n\n`;
      }
      fullContext += `Contenido:\n${document.content}\n`;
    }

    return fullContext;
  }

  // Get context for institution only
  buildInstitutionContext() {
    const institutionContext = this.getInstitutionContext();
    if (institutionContext) {
      return `=== CONTEXTO DE LA INSTITUCION ===\n${institutionContext}`;
    }
    return '';
  }
}

export default new LibraryService();
