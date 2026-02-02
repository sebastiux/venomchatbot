"""Google Sheets and Calendar service."""
import os
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from google.oauth2 import service_account
from googleapiclient.discovery import build
from ..config import get_settings


class GoogleService:
    """Service for Google Sheets and Calendar integration."""

    def __init__(self):
        settings = get_settings()
        self.sheet_id = settings.google_sheet_id
        self.meet_link = settings.meet_link
        self.karuna_email = settings.karuna_email
        self.credentials_path = settings.google_credentials_path
        self.calendar_id = "98c7c45883afcff9bce5a3e3ca64f0a64e589ab35657a749df90d826a55cae4f@group.calendar.google.com"

        self.sheets = None
        self.calendar = None

        self._initialize_services()

    def _initialize_services(self) -> None:
        """Initialize Google API services."""
        try:
            if not os.path.exists(self.credentials_path):
                print(f"WARNING: Google credentials not found at {self.credentials_path}")
                return

            credentials = service_account.Credentials.from_service_account_file(
                self.credentials_path,
                scopes=[
                    'https://www.googleapis.com/auth/spreadsheets',
                    'https://www.googleapis.com/auth/calendar'
                ]
            )

            self.sheets = build('sheets', 'v4', credentials=credentials)
            self.calendar = build('calendar', 'v3', credentials=credentials)
            print("Google services initialized successfully")

        except Exception as e:
            print(f"Error initializing Google services: {str(e)}")

    async def registrar_cita(self, datos: Dict[str, str]) -> Dict[str, Any]:
        """Register an appointment in Google Sheets and Calendar."""
        name = datos.get("name", "")
        company = datos.get("company", "")
        service = datos.get("service", "")
        email = datos.get("email", "")
        phone = datos.get("phone", "")
        fecha = datos.get("date", "")
        hora = datos.get("time", "")

        try:
            print("Registering in Google Sheets...")

            if not self.sheets or not self.calendar:
                return {"success": False, "error": "Google services not initialized"}

            # 1. Register in Google Sheets
            now = datetime.now().strftime("%d/%m/%Y %H:%M")

            self.sheets.spreadsheets().values().append(
                spreadsheetId=self.sheet_id,
                range='Citas!A:H',
                valueInputOption='USER_ENTERED',
                body={
                    'values': [[
                        now,
                        name,
                        company,
                        email,
                        phone,
                        service,
                        fecha,
                        hora
                    ]]
                }
            ).execute()

            print("Registered in Sheets")
            print("Creating Calendar event...")

            # 2. Create calendar event
            year, month, day = map(int, fecha.split('-'))
            hours, minutes = map(int, hora.split(':'))

            start_datetime = datetime(year, month, day, hours, minutes)
            end_datetime = start_datetime + timedelta(hours=1)

            event = self.calendar.events().insert(
                calendarId=self.calendar_id,
                body={
                    'summary': f'Consulta Karuna: {service}',
                    'description': '\n'.join([
                        f'Cliente: {name}',
                        f'Empresa: {company}',
                        f'Email: {email}',
                        f'Telefono: {phone}',
                        f'Servicio: {service}',
                        '',
                        f'Link de videollamada: {self.meet_link}',
                        '',
                        'Cita agendada via WhatsApp Bot'
                    ]),
                    'location': self.meet_link,
                    'start': {
                        'dateTime': start_datetime.isoformat(),
                        'timeZone': 'America/Mexico_City'
                    },
                    'end': {
                        'dateTime': end_datetime.isoformat(),
                        'timeZone': 'America/Mexico_City'
                    },
                    'reminders': {
                        'useDefault': False,
                        'overrides': [
                            {'method': 'popup', 'minutes': 30}
                        ]
                    }
                }
            ).execute()

            print("Calendar event created")
            print(f"Meet link: {self.meet_link}")

            # Format date for response
            formatted_date = start_datetime.strftime("%A, %d de %B de %Y a las %H:%M")

            return {
                "success": True,
                "event_id": event.get("id"),
                "meet_link": self.meet_link,
                "html_link": event.get("htmlLink"),
                "start_datetime": formatted_date
            }

        except Exception as error:
            print(f"Error registering appointment: {str(error)}")
            return {
                "success": False,
                "error": str(error)
            }

    def generar_ics(self, datos: Dict[str, str]) -> str:
        """Generate ICS calendar file content."""
        name = datos.get("name", "")
        company = datos.get("company", "")
        service = datos.get("service", "")
        email = datos.get("email", "")
        fecha = datos.get("date", "")
        hora = datos.get("time", "")

        year, month, day = map(int, fecha.split('-'))
        hours, minutes = map(int, hora.split(':'))

        start_datetime = datetime(year, month, day, hours, minutes)
        end_datetime = start_datetime + timedelta(hours=1)

        def format_date(dt: datetime) -> str:
            return dt.strftime("%Y%m%dT%H%M%SZ")

        now = datetime.utcnow()

        return f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Karuna//WhatsApp Bot//ES
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:karuna-{int(now.timestamp())}@karuna.es.com
DTSTAMP:{format_date(now)}
DTSTART:{format_date(start_datetime)}
DTEND:{format_date(end_datetime)}
SUMMARY:Consulta Karuna: {service}
DESCRIPTION:Cliente: {name}\\nEmpresa: {company}\\nServicio: {service}\\nEmail: {email}\\n\\nLink de videollamada: {self.meet_link}
LOCATION:{self.meet_link}
STATUS:CONFIRMED
SEQUENCE:0
ORGANIZER;CN=Karuna:mailto:{self.karuna_email}
ATTENDEE;CN={name};RSVP=TRUE:mailto:{email}
END:VEVENT
END:VCALENDAR"""


# Singleton instance
google_service = GoogleService()
