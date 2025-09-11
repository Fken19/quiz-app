from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Q
from django.contrib.auth import get_user_model
from .models import (
    User, Question, Option, QuizSession, QuizResult,
    Group, GroupMembership, DailyUserStats, DailyGroupStats
)
from .serializers import (
    UserSerializer, QuestionSerializer, QuizSessionSerializer,
    QuizSessionCreateSerializer, AnswerSubmissionSerializer,
    QuizResultSerializer, GroupSerializer, GroupMembershipSerializer,
    DailyUserStatsSerializer, DailyGroupStatsSerializer
)
from rest_framework.permissions import AllowAny
class GoogleAuthView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        """
        Google認証後のユーザー登録・取得API
        既存ユーザーがいれば返し、いなければ新規作成
        """
        print(f"Google auth request received: {request.data}")
        
        email = request.data.get('email')
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')
        display_name = f"{first_name} {last_name}".strip()
        profile_picture = request.data.get('profile_picture', '')
        google_id = request.data.get('google_id', '')

        if not email:
            print("Error: email is required")
            return Response({'error': 'email is required'}, status=400)

        try:
            UserModel = get_user_model()
            user, created = UserModel.objects.get_or_create(email=email, defaults={
                'username': email,
                'display_name': display_name or email,
                'first_name': first_name,
                'last_name': last_name,
            })
            # 必要ならプロフィール画像やGoogle IDも保存
            if display_name and user.display_name != display_name:
                user.display_name = display_name
                user.save()

            serializer = UserSerializer(user)
            print(f"User created/found: {serializer.data}")
            return Response({'user': serializer.data, 'created': created}, status=200)
        except Exception as e:
            print(f"Error creating/finding user: {str(e)}")
            return Response({'error': str(e)}, status=500)


class HealthCheckView(APIView):
    """ヘルスチェック用エンドポイント"""
    permission_classes = []  # 認証不要
    
    def get(self, request):
        return Response({
            'status': 'healthy',
            'timestamp': timezone.now().isoformat(),
            'service': 'quiz-api'
        })


class QuestionViewSet(viewsets.ReadOnlyModelViewSet):
    """問題取得API"""
    queryset = Question.objects.all()
    serializer_class = QuestionSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        queryset = Question.objects.prefetch_related('options')
        level = self.request.query_params.get('level')
        segment = self.request.query_params.get('segment')
        limit = self.request.query_params.get('limit')
        
        if level:
            queryset = queryset.filter(level=level)
        if segment:
            queryset = queryset.filter(segment=segment)
        if limit:
            try:
                queryset = queryset[:int(limit)]
            except ValueError:
                pass
                
        return queryset


class QuizSessionViewSet(viewsets.ModelViewSet):
    """クイズセッション管理API"""
    queryset = QuizSession.objects.all()
    serializer_class = QuizSessionSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return QuizSession.objects.filter(user=self.request.user).prefetch_related('results__question', 'results__chosen_option')
    
    def get_serializer_class(self):
        if self.action == 'create':
            return QuizSessionCreateSerializer
        return QuizSessionSerializer
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    
    @action(detail=True, methods=['post'])
    def answers(self, request, pk=None):
        """回答送信"""
        session = self.get_object()
        serializer = AnswerSubmissionSerializer(data=request.data)
        
        if serializer.is_valid():
            question_id = serializer.validated_data['question_id']
            chosen_option_id = serializer.validated_data.get('chosen_option_id')
            elapsed_ms = serializer.validated_data.get('elapsed_ms')
            
            question = get_object_or_404(Question, id=question_id)
            chosen_option = None
            is_correct = False
            
            if chosen_option_id:
                chosen_option = get_object_or_404(Option, id=chosen_option_id, question=question)
                is_correct = chosen_option.is_correct
            
            # 既存の回答を確認（重複防止）
            existing_result = QuizResult.objects.filter(session=session, question=question).first()
            if existing_result:
                # 既存の回答を更新
                existing_result.chosen_option = chosen_option
                existing_result.is_correct = is_correct
                existing_result.elapsed_ms = elapsed_ms
                existing_result.save()
                result = existing_result
            else:
                # 新しい回答を作成
                result = QuizResult.objects.create(
                    session=session,
                    question=question,
                    chosen_option=chosen_option,
                    is_correct=is_correct,
                    elapsed_ms=elapsed_ms
                )
            
            return Response(QuizResultSerializer(result).data)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """セッション完了"""
        session = self.get_object()
        total_time_ms = request.data.get('total_time_ms')
        
        session.completed_at = timezone.now()
        if total_time_ms:
            session.total_time_ms = total_time_ms
        session.save()
        
        return Response({'status': 'completed'})


class CurrentUserView(APIView):
    """現在のユーザー情報"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


class UserResultsView(APIView):
    """ユーザーの結果履歴"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        sessions = QuizSession.objects.filter(
            user=request.user
        ).prefetch_related('results__question', 'results__chosen_option').order_by('-started_at')
        
        # 日付フィルター
        from_date = request.query_params.get('from')
        to_date = request.query_params.get('to')
        if from_date:
            sessions = sessions.filter(started_at__date__gte=from_date)
        if to_date:
            sessions = sessions.filter(started_at__date__lte=to_date)
        
        serializer = QuizSessionSerializer(sessions, many=True)
        return Response(serializer.data)


# 管理者用ビュー
class AdminUserListView(APIView):
    """管理者用：ユーザー一覧"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        if not request.user.is_staff:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        users = User.objects.all().order_by('-created_at')
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)


class AdminGroupListView(APIView):
    """管理者用：グループ一覧"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        if not request.user.is_staff:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        groups = Group.objects.all().order_by('-created_at')
        serializer = GroupSerializer(groups, many=True)
        return Response(serializer.data)


class AdminDailyStatsView(APIView):
    """管理者用：日次統計"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        if not request.user.is_staff:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        scope = request.query_params.get('scope', 'user')  # user or group
        from_date = request.query_params.get('from')
        to_date = request.query_params.get('to')
        
        if scope == 'group':
            queryset = DailyGroupStats.objects.all()
            if from_date:
                queryset = queryset.filter(date__gte=from_date)
            if to_date:
                queryset = queryset.filter(date__lte=to_date)
            serializer = DailyGroupStatsSerializer(queryset, many=True)
        else:
            queryset = DailyUserStats.objects.all()
            if from_date:
                queryset = queryset.filter(date__gte=from_date)
            if to_date:
                queryset = queryset.filter(date__lte=to_date)
            serializer = DailyUserStatsSerializer(queryset, many=True)
        
        return Response(serializer.data)


class UserDashboardView(APIView):
    """ユーザーダッシュボード・集計データ"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        from django.db.models import Sum, Count, Avg
        from datetime import datetime, timedelta
        from django.utils import timezone
        import pytz
        
        user = request.user
        now = timezone.now()
        jst = pytz.timezone('Asia/Tokyo')
        now_jst = now.astimezone(jst)
        
        # 全ユーザーの結果を取得
        all_results = QuizResult.objects.filter(
            session__user=user
        ).select_related('session').order_by('created_at')
        
        # 全体統計
        total_stats = all_results.aggregate(
            total_questions=Count('id'),
            total_correct=Sum('is_correct'),
            avg_time=Avg('elapsed_ms')
        )
        
        total_questions = total_stats['total_questions'] or 0
        total_correct = total_stats['total_correct'] or 0
        overall_accuracy = round((total_correct / total_questions * 100), 2) if total_questions else 0
        overall_avg_time = round((total_stats['avg_time'] or 0) / 1000, 2)  # ミリ秒→秒
        
        # 今日の統計
        today_start = now_jst.replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow_start = today_start + timedelta(days=1)
        today_results = all_results.filter(
            created_at__gte=today_start.astimezone(timezone.utc),
            created_at__lt=tomorrow_start.astimezone(timezone.utc)
        )
        day_stats = today_results.aggregate(
            count=Count('id'),
            correct=Sum('is_correct'),
            avg_time=Avg('elapsed_ms')
        )
        day_total_words = day_stats['count'] or 0
        day_total_correct = day_stats['correct'] or 0
        day_accuracy = round((day_total_correct / day_total_words * 100), 2) if day_total_words else 0
        day_avg_time = round((day_stats['avg_time'] or 0) / 1000, 2)
        
        # 今週の統計
        week_start = now_jst - timedelta(days=now_jst.weekday())
        week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
        next_week_start = week_start + timedelta(days=7)
        week_results = all_results.filter(
            created_at__gte=week_start.astimezone(timezone.utc),
            created_at__lt=next_week_start.astimezone(timezone.utc)
        )
        week_stats = week_results.aggregate(
            count=Count('id'),
            correct=Sum('is_correct'),
            avg_time=Avg('elapsed_ms')
        )
        week_total_words = week_stats['count'] or 0
        week_total_correct = week_stats['correct'] or 0
        week_accuracy = round((week_total_correct / week_total_words * 100), 2) if week_total_words else 0
        week_avg_time = round((week_stats['avg_time'] or 0) / 1000, 2)
        
        # 今月の統計
        month_start = now_jst.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if month_start.month == 12:
            next_month_start = month_start.replace(year=month_start.year + 1, month=1)
        else:
            next_month_start = month_start.replace(month=month_start.month + 1)
        month_results = all_results.filter(
            created_at__gte=month_start.astimezone(timezone.utc),
            created_at__lt=next_month_start.astimezone(timezone.utc)
        )
        month_stats = month_results.aggregate(
            count=Count('id'),
            correct=Sum('is_correct'),
            avg_time=Avg('elapsed_ms')
        )
        month_total_words = month_stats['count'] or 0
        month_total_correct = month_stats['correct'] or 0
        month_accuracy = round((month_total_correct / month_total_words * 100), 2) if month_total_words else 0
        month_avg_time = round((month_stats['avg_time'] or 0) / 1000, 2)
        
        # グラフ用データ（簡易版）
        # 日別（直近7日）
        daily_data = []
        for i in range(7):
            day = today_start - timedelta(days=6-i)
            day_end = day + timedelta(days=1)
            day_results = all_results.filter(
                created_at__gte=day.astimezone(timezone.utc),
                created_at__lt=day_end.astimezone(timezone.utc)
            )
            day_count = day_results.aggregate(
                correct=Sum('is_correct'),
                incorrect=Count('id') - Sum('is_correct')
            )
            daily_data.append({
                'date': day.strftime('%m/%d'),
                'correct': day_count['correct'] or 0,
                'incorrect': (day_count['incorrect'] or 0)
            })
        
        # セッション数
        total_sessions = QuizSession.objects.filter(user=user).count()
        
        return Response({
            # 全体統計
            'total_words': total_questions,
            'overall_accuracy': overall_accuracy,
            'overall_avg_time': overall_avg_time,
            'total_quizzes': total_sessions,
            
            # 期間別統計
            'daily_count': day_total_words,
            'daily_accuracy': day_accuracy,
            'daily_avg_time': day_avg_time,
            
            'weekly_count': week_total_words,
            'weekly_accuracy': week_accuracy,
            'weekly_avg_time': week_avg_time,
            
            'monthly_count': month_total_words,
            'monthly_accuracy': month_accuracy,
            'monthly_avg_time': month_avg_time,
            
            # グラフデータ
            'day_graph_data': daily_data,
        })


class UserProfileView(APIView):
    """ユーザープロフィール管理"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """プロフィール情報取得"""
        user = request.user
        return Response({
            'id': user.id,
            'email': user.email,
            'display_name': user.display_name,
            'nickname': getattr(user, 'nickname', user.display_name or user.email),
            'custom_icon_url': getattr(user, 'custom_icon_url', None),
            'user_id': getattr(user, 'user_id', str(user.id)),
        })
    
    def put(self, request):
        """プロフィール情報更新"""
        user = request.user
        nickname = request.data.get('nickname', '').strip()
        
        if nickname:
            user.display_name = nickname
            # カスタムフィールドがあれば設定
            if hasattr(user, 'nickname'):
                user.nickname = nickname
        
        user.save()
        
        return Response({
            'status': 'success',
            'message': 'プロフィールを更新しました'
        })


class QuizSubmitView(APIView):
    """クイズ結果一括送信（Flask互換）"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """Flask app.py の /submit ルートと互換性のある結果送信"""
        data = request.data
        
        # バリデーション
        if not isinstance(data.get("score"), int) or not isinstance(data.get("total"), int):
            return Response({"status": "error", "message": "Invalid input types"}, status=status.HTTP_400_BAD_REQUEST)
        if data.get("total", 0) <= 0:
            return Response({"status": "error", "message": "Total must be positive"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = request.user
            
            # セッション作成
            session = QuizSession.objects.create(
                user=user,
                started_at=timezone.now(),
                completed_at=timezone.now(),
                total_time_ms=int((data.get("time", 0)) * 1000)  # 秒→ミリ秒
            )
            
            # 結果詳細保存
            for detail in data.get("results", []):
                question_text = detail.get("question", "")
                user_answer = detail.get("userAnswer", "")
                correct_answer = detail.get("correctAnswer", "")
                answer_time = detail.get("time", 0)
                
                # 問題IDを取得（テキストから逆引き）
                question = Question.objects.filter(text=question_text).first()
                chosen_option = None
                is_correct = (user_answer == correct_answer)
                
                if question:
                    chosen_option = Option.objects.filter(
                        question=question,
                        text=user_answer
                    ).first()
                
                QuizResult.objects.create(
                    session=session,
                    question=question,
                    chosen_option=chosen_option,
                    is_correct=is_correct,
                    elapsed_ms=int(answer_time * 1000)  # 秒→ミリ秒
                )
            
            return Response({"status": "success"}, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                "status": "error", 
                "message": f"データ保存に失敗しました: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class QuizLevelsView(APIView):
    """クイズレベル一覧（Flask互換）"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """レベル分けされた問題一覧を返す"""
        total_questions = Question.objects.count()
        segment_size = 50
        total_levels = (total_questions + segment_size - 1) // segment_size
        
        levels_list = []
        for i in range(total_levels):
            levels_list.append({
                'level': i + 1,
                'start': i * segment_size + 1,
                'end': min((i + 1) * segment_size, total_questions)
            })
        
        return Response({
            'levels': levels_list,
            'total_questions': total_questions
        })


class QuizSegmentsView(APIView):
    """レベル内セグメント一覧（Flask互換）"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, level):
        """指定レベル内のセグメント一覧を返す"""
        segment_size = 10
        total_segments = 5
        
        segments_list = []
        for i in range(total_segments):
            segments_list.append({
                'segment': i + 1,
                'start': i * segment_size + 1,
                'end': (i + 1) * segment_size
            })
        
        return Response({
            'level': level,
            'segments': segments_list
        })


class QuizLevelQuestionsView(APIView):
    """レベル別問題取得（Flask互換）"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, level, segment=None):
        """指定レベル・セグメントの問題を返す"""
        segment_size = 50
        start_index = (int(level) - 1) * segment_size
        
        questions = Question.objects.all().prefetch_related('options')[start_index:start_index + segment_size]
        
        if segment is not None:
            # セグメント指定がある場合はさらに絞る
            seg_size = 10
            seg_start = (int(segment) - 1) * seg_size
            seg_end = seg_start + seg_size
            questions = list(questions)[seg_start:seg_end]
        
        serializer = QuestionSerializer(questions, many=True)
        return Response({
            'level': level,
            'segment': segment,
            'questions': serializer.data
        })


class AuthStatusView(APIView):
    """認証状態確認（Flask /auth_status互換）"""
    permission_classes = [permissions.AllowAny]
    
    def get(self, request):
        if request.user.is_authenticated:
            return Response({
                'authenticated': True,
                'user': {
                    'id': request.user.id,
                    'username': request.user.username,
                    'email': request.user.email,
                    'display_name': request.user.display_name or request.user.username,
                    'avatar_url': request.user.avatar_url
                }
            })
        else:
            return Response({'authenticated': False})


class LogoutView(APIView):
    """ログアウト（Flask /logout互換）"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """ログアウト処理"""
        # セッション削除
        if hasattr(request, 'session'):
            request.session.flush()
        
        return Response({
            'status': 'success',
            'message': 'ログアウトしました'
        })
