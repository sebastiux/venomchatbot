import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FLOW_PROMPTS } from '../config/flowPrompts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ConfigService {
  constructor() {
    this.configPath = path.join(__dirname, '../../config/bot-config.json');
    this.ensureConfigFile();
  }

  ensureConfigFile() {
    const configDir = path.dirname(this.configPath);
    
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    if (!fs.existsSync(this.configPath)) {
      const defaultConfig = {
        blacklist: [],
        currentFlow: 'karuna',
        systemPrompt: FLOW_PROMPTS.karuna.prompt,
        customFlows: {}
      };
      fs.writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 2));
      console.log('✅ Archivo de configuración creado');
    }
  }

  getConfig() {
    try {
      const data = fs.readFileSync(this.configPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error al leer configuración:', error);
      return { blacklist: [], systemPrompt: '', currentFlow: 'karuna', customFlows: {} };
    }
  }

  saveConfig(config) {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      console.log('✅ Configuración guardada');
      return true;
    } catch (error) {
      console.error('Error al guardar configuración:', error);
      return false;
    }
  }

  // Blacklist methods
  getBlacklist() {
    const config = this.getConfig();
    return config.blacklist || [];
  }

  addToBlacklist(number) {
    const config = this.getConfig();
    if (!config.blacklist.includes(number)) {
      config.blacklist.push(number);
      this.saveConfig(config);
      console.log(`📵 Número ${number} agregado a blacklist`);
      return true;
    }
    return false;
  }

  removeFromBlacklist(number) {
    const config = this.getConfig();
    config.blacklist = config.blacklist.filter(n => n !== number);
    this.saveConfig(config);
    console.log(`✅ Número ${number} removido de blacklist`);
    return true;
  }

  isBlacklisted(number) {
    const blacklist = this.getBlacklist();
    return blacklist.includes(number);
  }

  // System Prompt methods
  getSystemPrompt() {
    const config = this.getConfig();
    return config.systemPrompt || '';
  }

  updateSystemPrompt(newPrompt) {
    const config = this.getConfig();
    config.systemPrompt = newPrompt;
    this.saveConfig(config);
    console.log('✅ System prompt actualizado');
    return true;
  }

  // Flow methods
  getCurrentFlow() {
    const config = this.getConfig();
    return config.currentFlow || 'karuna';
  }

  getAllFlows() {
    const config = this.getConfig();
    const customFlows = config.customFlows || {};
    
    // Merge default flows with custom flows
    const allFlows = { ...FLOW_PROMPTS };
    
    Object.keys(customFlows).forEach(key => {
      allFlows[key] = {
        ...customFlows[key],
        isDefault: false
      };
    });
    
    return allFlows;
  }

  getFlowData(flowId) {
    const allFlows = this.getAllFlows();
    return allFlows[flowId] || null;
  }

  setFlow(flowId) {
    const config = this.getConfig();
    const flowData = this.getFlowData(flowId);
    
    if (!flowData) {
      console.error(`❌ Flow inválido: ${flowId}`);
      return false;
    }
    
    config.currentFlow = flowId;
    config.systemPrompt = flowData.prompt;
    this.saveConfig(config);
    console.log(`✅ Flow cambiado a: ${flowId}`);
    return true;
  }

  createCustomFlow(flowId, name, description, prompt, hasMenu, menuConfig) {
    // Validate flowId doesn't exist in default flows
    if (FLOW_PROMPTS[flowId]) {
      console.error(`❌ No se puede crear flow con ID de flow predefinido: ${flowId}`);
      return { success: false, message: 'El ID del flow ya existe en los flows predefinidos' };
    }
    
    // Validate flowId format (alphanumeric and underscore only)
    if (!/^[a-z0-9_]+$/.test(flowId)) {
      return { success: false, message: 'El ID solo puede contener letras minúsculas, números y guiones bajos' };
    }
    
    const config = this.getConfig();
    if (!config.customFlows) {
      config.customFlows = {};
    }
    
    // Check if custom flow already exists
    if (config.customFlows[flowId]) {
      return { success: false, message: 'Ya existe un flow personalizado con ese ID' };
    }
    
    config.customFlows[flowId] = {
      name,
      description,
      prompt,
      hasMenu: hasMenu || false,
      menuConfig: menuConfig || null,
      createdAt: new Date().toISOString()
    };
    
    this.saveConfig(config);
    console.log(`✅ Flow personalizado creado: ${flowId}`);
    return { success: true, message: 'Flow creado exitosamente' };
  }

  updateCustomFlow(flowId, name, description, prompt, hasMenu, menuConfig) {
    // Cannot update default flows
    if (FLOW_PROMPTS[flowId]) {
      return { success: false, message: 'No se pueden editar flows predefinidos' };
    }
    
    const config = this.getConfig();
    
    if (!config.customFlows || !config.customFlows[flowId]) {
      return { success: false, message: 'Flow personalizado no encontrado' };
    }
    
    config.customFlows[flowId] = {
      ...config.customFlows[flowId],
      name,
      description,
      prompt,
      hasMenu: hasMenu || false,
      menuConfig: menuConfig || null,
      updatedAt: new Date().toISOString()
    };
    
    this.saveConfig(config);
    
    // If this is the current flow, update the system prompt
    if (config.currentFlow === flowId) {
      config.systemPrompt = prompt;
      this.saveConfig(config);
    }
    
    console.log(`✅ Flow personalizado actualizado: ${flowId}`);
    return { success: true, message: 'Flow actualizado exitosamente' };
  }

  deleteCustomFlow(flowId) {
    // Cannot delete default flows
    if (FLOW_PROMPTS[flowId]) {
      return { success: false, message: 'No se pueden eliminar flows predefinidos' };
    }
    
    const config = this.getConfig();
    
    if (!config.customFlows || !config.customFlows[flowId]) {
      return { success: false, message: 'Flow personalizado no encontrado' };
    }
    
    // If this is the current flow, switch to karuna
    if (config.currentFlow === flowId) {
      config.currentFlow = 'karuna';
      config.systemPrompt = FLOW_PROMPTS.karuna.prompt;
    }
    
    delete config.customFlows[flowId];
    this.saveConfig(config);
    
    console.log(`✅ Flow personalizado eliminado: ${flowId}`);
    return { success: true, message: 'Flow eliminado exitosamente' };
  }

  getAvailableFlows() {
    return Object.keys(this.getAllFlows());
  }

  // Menu handling for flows with submenus
  shouldShowMenu(flowId, userId) {
    const flowData = this.getFlowData(flowId);
    if (!flowData || !flowData.hasMenu || !flowData.menuConfig) {
      return false;
    }
    return true;
  }

  getMenuForFlow(flowId) {
    const flowData = this.getFlowData(flowId);
    if (!flowData || !flowData.hasMenu || !flowData.menuConfig) {
      return null;
    }
    return flowData.menuConfig;
  }
}

export default new ConfigService();