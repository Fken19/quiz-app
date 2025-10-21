import time
import logging
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger('quiz.middleware')


class ServerTimingMiddleware(MiddlewareMixin):
    """Middleware that measures request processing time and adds Server-Timing header.

    It also records optional named stages by checking for a `request._timing_marks` list
    which other code can append tuples to: (name, duration_ms).
    """

    def process_request(self, request):
        request._server_timing_start = time.perf_counter()
        # container where view or other code can append timing marks
        request._timing_marks = []

    def process_response(self, request, response):
        try:
            start = getattr(request, '_server_timing_start', None)
            if start is None:
                return response

            total_ms = int((time.perf_counter() - start) * 1000)

            # build Server-Timing value: total and any marks
            parts = [f"total;dur={total_ms}"]
            marks = getattr(request, '_timing_marks', []) or []
            for name, ms in marks:
                # sanitize name
                safe_name = ''.join(c for c in name if c.isalnum() or c in ('_', '-')).strip() or 'mark'
                parts.append(f"{safe_name};dur={int(ms)}")

            header_value = ', '.join(parts)
            response['Server-Timing'] = header_value

            # also log for server-side inspection
            try:
                logger.info('ServerTiming %sms %s', total_ms, header_value)
            except Exception:
                pass
        except Exception as e:
            logger.exception('ServerTiming middleware error: %s', e)
        return response
