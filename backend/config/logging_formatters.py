"""
JSON Logging Formatter

Formateador de logging que serializa cada registro como una línea JSON,
facilitando el parseo automático por agregadores de logs (Cloud Logging,
CloudWatch, ELK, etc.) en producción.

No requiere dependencias externas: usa solo la librería estándar `json`.
"""

import json
import logging
from datetime import datetime, timezone
from traceback import format_exception


class JsonFormatter(logging.Formatter):
    """Serializa cada registro de log como un único objeto JSON por línea."""

    # Nombres de atributos estándar de logging. El resto de la key extra del
    # record se incluye en el JSON de forma plana (para preservar metadatos
    # como user_id, ip, username que se pasan vía extra={...}).
    _STANDARD_FIELDS = {
        'name', 'levelname', 'levelno', 'pathname', 'filename', 'module',
        'exc_info', 'exc_text', 'stack_info', 'lineno', 'funcName', 'msecs',
        'relativeCreated', 'thread', 'threadName', 'processName', 'process',
        'taskName', 'args', 'msg', 'message', 'asctime', 'created',
    }

    def format(self, record):
        """Convierte el record en un objeto dict y lo serializa a JSON."""
        payload = self._build_payload(record)

        # Si hay excepción, se serializa como lista de string para que el
        # traceback quede legible dentro del JSON (no como \n escapado).
        if record.exc_info:
            payload['exc_info'] = ''.join(format_exception(*record.exc_info)).splitlines()

        # Se usa ensure_ascii=False para conservar caracteres UTF-8 (ñ, á...)
        # de forma legible. Los agregadores de logs modernos lo soportan bien.
        return json.dumps(payload, ensure_ascii=False, default=str)

    def _build_payload(self, record):
        """Arma el dict base con los campos estándar de cada registro."""
        payload = {
            'timestamp': self._iso_timestamp(record),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'funcName': record.funcName,
            'lineno': record.lineno,
        }

        # Incluye cualquier metadata extra pasada con extra={...}
        # (ej: user_id, username, ip) de forma plana en el JSON.
        for key, value in record.__dict__.items():
            if key in self._STANDARD_FIELDS:
                continue
            payload[key] = value

        return payload

    @staticmethod
    def _iso_timestamp(record):
        """Timestamp en formato ISO-8601 con zona horaria UTC y milisegundos."""
        created = datetime.fromtimestamp(record.created, tz=timezone.utc)
        return created.isoformat(timespec='milliseconds').replace('+00:00', 'Z')