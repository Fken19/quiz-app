import logging
from django.http import JsonResponse
from rest_framework.authtoken.models import Token
from django.contrib.auth import get_user_model
from .utils import is_teacher_whitelisted
from .models import Teacher

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
                        
                        # 権限をログ出力
                        self._log_user_permission(token.user)
                        
                    except Token.DoesNotExist:
                        # トークンが見つからない場合、メールアドレスかチェック
                        if '@' in token_key and '.' in token_key:
                            try:
                                user = User.objects.get(email=token_key)
                                logger.info(f"User found by email token: {user.email}")
                                request.user = user
                                
                                # 権限をログ出力
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
        """ユーザーの講師権限状態をログ出力"""
        try:
            if not user.email:
                return
            is_wl = is_teacher_whitelisted(user.email)
            logger.info(f"User {user.email} whitelisted={is_wl}")
        except Exception:
            pass


class TeacherAccessControlMiddleware:
    """
    講師ポータルへのアクセス制御ミドルウェア
    
    設計書の要件:
    - Google認証OK ∧ メールがteachers_whitelistsに存在 で入場可
    - ホワイトリストに未登録の場合はアクセス拒否
    """
    
    TEACHER_PATHS = [
        '/api/teachers/',
        '/api/teacher-profiles/',
        '/api/teacher-whitelists/',
        '/api/tests/',
        '/api/test-questions/',
        '/api/test-assignments/',
        '/api/test-assignees/',
        '/api/roster-folders/',
        '/api/roster-memberships/',
        '/api/invitation-codes/',
    ]
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # 講師APIへのアクセスをチェック
        if self._is_teacher_path(request.path):
            if not request.user.is_authenticated:
                return JsonResponse(
                    {'error': 'Authentication required'},
                    status=401
                )
            
            # ホワイトリストチェック
            if not is_teacher_whitelisted(request.user.email):
                logger.warning(
                    f"Access denied: {request.user.email} not in teacher whitelist"
                )
                return JsonResponse(
                    {
                        'error': 'Teacher access denied',
                        'detail': 'Your email is not registered in the teacher whitelist. '
                                  'Please contact an administrator.'
                    },
                    status=403
                )
            
            # Teacherレコードの存在確認と自動作成
            teacher, created = Teacher.objects.get_or_create(
                email=request.user.email.lower(),
                defaults={
                    'oauth_provider': getattr(request.user, 'oauth_provider', 'google'),
                    'oauth_sub': getattr(request.user, 'oauth_sub', '') + '_teacher',
                }
            )
            
            if created:
                logger.info(f"Auto-created Teacher record for {request.user.email}")
            
            # Teacherインスタンスをrequestに追加（APIで利用可能に）
            request.teacher = teacher
        
        response = self.get_response(request)
        return response
    
    def _is_teacher_path(self, path):
        """講師専用パスかどうかを判定"""
        return any(path.startswith(prefix) for prefix in self.TEACHER_PATHS)
