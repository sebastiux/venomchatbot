// src/services/GoogleService.js
import { google } from 'googleapis';

class GoogleService {
  constructor() {
    this.auth = new google.auth.GoogleAuth({
      keyFile: './google-credentials.json',
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/calendar'
      ]
    });
    
    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    this.calendar = google.calendar({ version: 'v3', auth: this.auth });
  }

  async registrarCita(datos) {
    const { name, company, service, email, phone, fecha, hora } = datos;
    
    try {
      console.log('📝 Registrando en Google Sheets...');
      
      // 1. Registrar en Google Sheets
      const spreadsheetId = process.env.GOOGLE_SHEET_ID;
      await this.sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Citas!A:H',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[
            new Date().toLocaleString('es-MX'),
            name,
            company,
            email,
            phone,
            service,
            fecha,
            hora
          ]]
        }
      });
      
      console.log('✅ Registrado en Sheets');
      console.log('📅 Creando evento en Calendar...');

      // 2. Crear evento sin Meet (lo agregaremos manual después)
      const [year, month, day] = fecha.split('-');
      const [hours, minutes] = hora.split(':');
      const startDateTime = new Date(year, month - 1, day, hours, minutes);
      const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

      // Código fijo para el Meet
    
      const meetLink = process.env.MEET_LINK;

      const event = await this.calendar.events.insert({
        calendarId: '98c7c45883afcff9bce5a3e3ca64f0a64e589ab35657a749df90d826a55cae4f@group.calendar.google.com',
        resource: {
          summary: `Consulta Karuna: ${service}`,
          description: [
            `👤 Cliente: ${name}`,
            `🏢 Empresa: ${company}`,
            `📧 Email: ${email}`,
            `📱 Teléfono: ${phone}`,
            `💼 Servicio: ${service}`,
            '',
            `🎥 Link de videollamada: ${meetLink}`,
            '',
            '📝 Cita agendada vía WhatsApp Bot'
          ].join('\n'),
          location: meetLink,
          start: {
            dateTime: startDateTime.toISOString(),
            timeZone: 'America/Mexico_City'
          },
          end: {
            dateTime: endDateTime.toISOString(),
            timeZone: 'America/Mexico_City'
          },
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: 30 }
            ]
          }
        }
      });

      console.log('✅ Evento creado en Calendar');
      console.log('🎥 Meet link:', meetLink);

      const startDateTimeFormatted = startDateTime.toLocaleString('es-MX', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      return {
        success: true,
        eventId: event.data.id,
        meetLink: meetLink,
        htmlLink: event.data.htmlLink,
        startDateTime: startDateTimeFormatted
      };
      
    } catch (error) {
      console.error('❌ Error registrando cita:', error.message);
      if (error.errors) {
        console.error('Detalles:', JSON.stringify(error.errors, null, 2));
      }
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  generarICS(datos, meetLink) {
    const { name, company, service, email, fecha, hora } = datos;
    const [year, month, day] = fecha.split('-');
    const [hours, minutes] = hora.split(':');
    const startDateTime = new Date(year, month - 1, day, hours, minutes);
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

    const formatDate = (date) => {
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      const hours = String(date.getUTCHours()).padStart(2, '0');
      const minutes = String(date.getUTCMinutes()).padStart(2, '0');
      const seconds = String(date.getUTCSeconds()).padStart(2, '0');
      return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
    };

    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Karuna//WhatsApp Bot//ES
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:karuna-${Date.now()}@karuna.es.com
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(startDateTime)}
DTEND:${formatDate(endDateTime)}
SUMMARY:Consulta Karuna: ${service}
DESCRIPTION:Cliente: ${name}\\nEmpresa: ${company}\\nServicio: ${service}\\nEmail: ${email}\\n\\n🎥 Link de videollamada: ${meetLink}
LOCATION:${meetLink}
STATUS:CONFIRMED
SEQUENCE:0
ORGANIZER;CN=Karuna:mailto:${process.env.KARUNA_EMAIL}
ATTENDEE;CN=${name};RSVP=TRUE:mailto:${email}
END:VEVENT
END:VCALENDAR`;
  }
}

export default new GoogleService();