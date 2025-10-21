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
                        
                        # 権限はwhitelistで判定（roleは変更しない）
                        self._log_user_permission(token.user)
                        
                    except Token.DoesNotExist:
                        # トークンが見つからない場合、メールアドレスかチェック
                        if '@' in token_key and '.' in token_key:
                            try:
                                user = User.objects.get(email=token_key)
                                logger.info(f"User found by email token: {user.email}")
                                request.user = user
                                
                                # 権限はwhitelistで判定（roleは変更しない）
                                self._log_user_permission(user)
                                
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
    
    def _log_user_permission(self, user):
        """ユーザーの講師権限状態をログ出力（roleは変更しない）"""
        try:
            if not user.email:
                return
            is_wl = is_teacher_whitelisted(user.email)
            logger.info(f"User {user.email} whitelisted={is_wl} role={getattr(user, 'role', None)}")
        except Exception:
            pass
