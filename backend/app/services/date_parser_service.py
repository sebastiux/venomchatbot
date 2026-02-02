"""Date parsing service using Grok AI."""
import json
import re
from datetime import datetime
from typing import Optional, Dict, Any
from openai import OpenAI
from ..config import get_settings


class DateParserService:
    """Service for parsing natural language dates using Grok AI."""

    def __init__(self):
        settings = get_settings()
        self.client = OpenAI(
            api_key=settings.xai_api_key,
            base_url="https://api.x.ai/v1"
        ) if settings.xai_api_key else None

    async def parsear_fecha_hora(self, texto_usuario: str) -> Optional[Dict[str, Any]]:
        """Parse natural language date/time from user input."""
        if not self.client:
            return None

        try:
            now = datetime.now()
            weekday = now.strftime("%A")

            prompt = f"""Fecha actual: {now.strftime("%Y-%m-%d")} ({weekday})
Hora actual: {now.strftime("%H:%M")}

El usuario dijo: "{texto_usuario}"

Extrae la fecha y hora que el usuario quiere agendar. Si solo menciona dia sin fecha especifica (ej: "manana", "el lunes"), calcula la fecha correcta.

RESPONDE SOLO CON JSON EN ESTE FORMATO EXACTO:
{{
  "fecha": "YYYY-MM-DD",
  "hora": "HH:MM",
  "interpretacion": "texto explicando lo que entendiste"
}}

Ejemplos:
- "manana a las 3 de la tarde" -> {{"fecha": "2025-10-28", "hora": "15:00", "interpretacion": "Manana martes 28 de octubre a las 3 PM"}}
- "el proximo viernes a las 10 am" -> {{"fecha": "2025-11-01", "hora": "10:00", "interpretacion": "Viernes 1 de noviembre a las 10 AM"}}
- "dentro de 3 dias a las 2" -> {{"fecha": "2025-10-30", "hora": "14:00", "interpretacion": "Jueves 30 de octubre a las 2 PM"}}"""

            completion = self.client.chat.completions.create(
                model="grok-4-fast-reasoning",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1
            )

            response = completion.choices[0].message.content

            # Extract JSON from response
            json_match = re.search(r'\{[\s\S]*\}', response)

            if json_match:
                parsed = json.loads(json_match.group())
                return {
                    "date": parsed.get("fecha"),
                    "time": parsed.get("hora"),
                    "interpretation": parsed.get("interpretacion")
                }

            raise ValueError("Could not parse response")

        except Exception as error:
            print(f"Error parsing date: {str(error)}")
            return None


# Singleton instance
date_parser_service = DateParserService()
