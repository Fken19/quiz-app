import logging
from django.http import HttpResponse
from rest_framework.authtoken.models import Token
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)
User = get_user_model()

class AuthDebugMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith('/api/'):
            logger.info(f"API Request: {request.method} {request.path}")
            
            # Authorization ヘッダーをチェック
            auth_header = request.META.get('HTTP_AUTHORIZATION')
            if auth_header:
                logger.info(f"Authorization Header: {auth_header[:20]}...")
                
                if auth_header.startswith('Bearer '):
                    token_key = auth_header[7:]
                    try:
                        token = Token.objects.get(key=token_key)
                        logger.info(f"Valid token found for user: {token.user.email}")
                        request.user = token.user
                    except Token.DoesNotExist:
                        logger.warning(f"Invalid token: {token_key[:10]}...")
                else:
                    logger.info(f"Non-Bearer auth header: {auth_header[:30]}")
            else:
                logger.info("No Authorization header found")
            
            # ユーザー情報をログ
            logger.info(f"Request user: {request.user} (authenticated: {request.user.is_authenticated})")

        response = self.get_response(request)
        
        if request.path.startswith('/api/') and response.status_code == 401:
            logger.warning(f"401 Unauthorized for {request.path}")
            
        return response
