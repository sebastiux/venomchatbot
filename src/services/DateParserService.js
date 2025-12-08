// src/services/DateParserService.js
import OpenAI from 'openai';

class DateParserService {
  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.XAI_API_KEY,
      baseURL: 'https://api.x.ai/v1'
    });
  }

  async parsearFechaHora(textoUsuario) {
    try {
      const hoy = new Date();
      const prompt = `Fecha actual: ${hoy.toISOString().split('T')[0]} (${hoy.toLocaleDateString('es-MX', { weekday: 'long' })})
Hora actual: ${hoy.getHours()}:${hoy.getMinutes().toString().padStart(2, '0')}

El usuario dijo: "${textoUsuario}"

Extrae la fecha y hora que el usuario quiere agendar. Si solo menciona día sin fecha específica (ej: "mañana", "el lunes"), calcula la fecha correcta.

RESPONDE SOLO CON JSON EN ESTE FORMATO EXACTO:
{
  "fecha": "YYYY-MM-DD",
  "hora": "HH:MM",
  "interpretacion": "texto explicando lo que entendiste"
}

Ejemplos:
- "mañana a las 3 de la tarde" → {"fecha": "2025-10-28", "hora": "15:00", "interpretacion": "Mañana martes 28 de octubre a las 3 PM"}
- "el próximo viernes a las 10 am" → {"fecha": "2025-11-01", "hora": "10:00", "interpretacion": "Viernes 1 de noviembre a las 10 AM"}
- "dentro de 3 días a las 2" → {"fecha": "2025-10-30", "hora": "14:00", "interpretacion": "Jueves 30 de octubre a las 2 PM"}`;

      const completion = await this.client.chat.completions.create({
        model: 'grok-4-fast-reasoning',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1
      });

      const respuesta = completion.choices[0].message.content;
      const jsonMatch = respuesta.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('No se pudo parsear la respuesta');
      
    } catch (error) {
      console.error('Error parseando fecha:', error);
      return null;
    }
  }
}

export default new DateParserService();