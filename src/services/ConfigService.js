import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
        systemPrompt: `Eres el asistente de atención al cliente de Karuna, una consultoría de tecnología. Eres el PRIMER contacto con los clientes.

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

Responde SIEMPRE en español, siendo útil, directo y enfocado en calificar y avanzar el lead.`
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
      return { blacklist: [], systemPrompt: '' };
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
}

export default new ConfigService();