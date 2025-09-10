"""
WSGI config for quiz_backend project.
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quiz_backend.settings')

application = get_wsgi_application()
