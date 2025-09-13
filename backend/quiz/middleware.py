import logging
from django.http import HttpResponse
from rest_framework.authtoken.models import Token
from django.contrib.auth import get_user_model
from .utils import is_teacher_whitelisted

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
                        # まずは通常のトークンを試す
                        token = Token.objects.get(key=token_key)
                        logger.info(f"Valid token found for user: {token.user.email}")
                        request.user = token.user
                        
                        # ユーザーのロールを自動設定
                        self._update_user_role(token.user)
                        
                    except Token.DoesNotExist:
                        # トークンが見つからない場合、メールアドレスかチェック
                        if '@' in token_key and '.' in token_key:
                            try:
                                user = User.objects.get(email=token_key)
                                logger.info(f"User found by email token: {user.email}")
                                request.user = user
                                
                                # ユーザーのロールを自動設定
                                self._update_user_role(user)
                                
                            except User.DoesNotExist:
                                logger.warning(f"User not found for email token: {token_key}")
                        else:
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
    
    def _update_user_role(self, user):
        """ユーザーのロールを自動更新"""
        if not user.email:
            return
        
        # ホワイトリストチェック
        if is_teacher_whitelisted(user.email):
            if user.role != 'teacher':
                logger.info(f"Updating user {user.email} role to teacher (whitelisted)")
                user.role = 'teacher'
                user.save(update_fields=['role'])
        else:
            # ホワイトリストにない場合は生徒として設定
            if user.role == 'teacher':
                logger.info(f"Updating user {user.email} role to student (not whitelisted)")
                user.role = 'student'
                user.save(update_fields=['role'])
