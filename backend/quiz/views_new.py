"""
新しいクイズスキーマ用のビュー
"""
from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Avg, Sum, Q

from .models_new import (
    Level, Segment, NewWord, SegmentWord, 
    NewWordTranslation, NewWordChoice, 
    NewQuizSession, NewQuizResult,
    NewDailyUserStats, NewDailyGroupStats
)
from .models import User
from .serializers_new import (
    LevelSerializer, SegmentListSerializer, SegmentQuizSerializer,
    WordDetailSerializer, WordSerializer,
    QuizSessionCreateSerializer, QuizSessionSerializer, QuizSessionListSerializer,
    QuizResultCreateSerializer, QuizResultSerializer,
    DailyUserStatsSerializer, DailyGroupStatsSerializer
)


class LevelViewSet(viewsets.ReadOnlyModelViewSet):
    """レベルビューセット（読み取り専用）"""
    queryset = Level.objects.all().order_by('created_at')
    serializer_class = LevelSerializer
    permission_classes = [IsAuthenticated]


class SegmentViewSet(viewsets.ReadOnlyModelViewSet):
    """セグメントビューセット（読み取り専用）"""
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = Segment.objects.select_related('level_id')
        
        # 公開済みのセグメントのみを表示
        queryset = queryset.filter(publish_status='published')
        
        # レベルでフィルタ
        level_id = self.request.query_params.get('level_id')
        if level_id:
            queryset = queryset.filter(level_id=level_id)
        
        return queryset.order_by('level_id__created_at', 'created_at')
    
    def get_serializer_class(self):
        if self.action == 'quiz':
            return SegmentQuizSerializer
        return SegmentListSerializer
    
    @action(detail=True, methods=['get'])
    def quiz(self, request, pk=None):
        """セグメントのクイズ問題を取得"""
        segment = self.get_object()
        
        # セグメントが公開済みかチェック
        if segment.publish_status != 'published':
            return Response(
                {'error': 'This segment is not published'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # セグメントが10問揃っているかチェック
        word_count = segment.segment_words.count()
        if word_count != 10:
            return Response(
                {'error': f'This segment has {word_count} questions, but 10 are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = self.get_serializer(segment)
        return Response(serializer.data)


class WordViewSet(viewsets.ReadOnlyModelViewSet):
    """単語ビューセット（読み取り専用）"""
    queryset = NewWord.objects.all().prefetch_related('translations', 'choices')
    serializer_class = WordDetailSerializer
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return WordSerializer
        return WordDetailSerializer


class QuizSessionViewSet(viewsets.ModelViewSet):
    """クイズセッションビューセット"""
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return NewQuizSession.objects.filter(user=self.request.user).select_related(
            'segment', 'segment__level_id'
        ).prefetch_related(
            'results', 'results__word', 'results__selected_choice'
        ).order_by('-started_at')
    
    def get_serializer_class(self):
        if self.action == 'create':
            return QuizSessionCreateSerializer
        elif self.action == 'list':
            return QuizSessionListSerializer
        return QuizSessionSerializer

    def create(self, request, *args, **kwargs):
        """作成時は検証に CreateSerializer を使い、応答は詳細シリアライザで返す（id 等を含める）"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        # 作成後のインスタンスを取得（ModelViewSet のデフォルトでは create 用シリアが返るため明示的に詳細で返す）
        instance = getattr(serializer, 'instance', None)
        if instance is None:
            # フォールバック: 直近の自分の未完了セッションを拾う
            instance = NewQuizSession.objects.filter(user=request.user).order_by('-started_at').first()
        out = QuizSessionSerializer(instance, context=self.get_serializer_context())
        headers = self.get_success_headers(out.data)
        return Response(out.data, status=status.HTTP_201_CREATED, headers=headers)
    
    @action(detail=True, methods=['post'])
    def submit_results(self, request, pk=None):
        """クイズ結果を一括で提出"""
        session = self.get_object()
        
        # 既に完了済みの場合はエラー
        if session.is_completed:
            return Response(
                {'error': 'This quiz session is already completed'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        results_data = request.data.get('results', [])
        
        if len(results_data) != 10:
            return Response(
                {'error': 'Exactly 10 results are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            # 既存の結果を削除
            session.results.all().delete()
            
            # 新しい結果を作成
            score = 0
            for result_data in results_data:
                result_data['session'] = session.id
                # selected_text が空なら、selected_choice から補完
                try:
                    if (not result_data.get('selected_text')) and result_data.get('selected_choice'):
                        choice_obj = NewWordChoice.objects.filter(pk=result_data['selected_choice']).first()
                        if choice_obj:
                            result_data['selected_text'] = choice_obj.text_ja
                except Exception:
                    pass

                serializer = QuizResultCreateSerializer(data=result_data)
                
                if serializer.is_valid():
                    result = serializer.save(session=session)
                    if result.is_correct:
                        score += 1
                else:
                    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            # セッション完了処理
            session.score = score
            session.completed_at = timezone.now()
            session.total_time_ms = request.data.get('total_time_ms')
            session.save()
            
            # 統計更新
            self._update_user_stats(session)
        
        return Response({
            'message': 'Results submitted successfully',
            'score': score,
            'score_percentage': (score / 10) * 100
        })
    
    def _update_user_stats(self, session):
        """ユーザー統計を更新"""
        today = timezone.now().date()
        
        stats, created = NewDailyUserStats.objects.get_or_create(
            date=today,
            user=session.user,
            defaults={
                'sessions_count': 0,
                'questions_attempted': 0,
                'questions_correct': 0,
                'total_time_ms': 0,
            }
        )
        
        stats.sessions_count += 1
        stats.questions_attempted += 10  # 常に10問
        stats.questions_correct += session.score
        stats.total_time_ms += session.total_time_ms or 0
        stats.save()


class DashboardViewSet(viewsets.ViewSet):
    """ダッシュボード用API"""
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def user_stats(self, request):
        """ユーザー統計取得"""
        user = request.user
        
        # 直近30日の統計
        stats = NewDailyUserStats.objects.filter(
            user=user,
            date__gte=timezone.now().date() - timezone.timedelta(days=30)
        ).order_by('date')
        
        # 総合統計
        total_stats = stats.aggregate(
            total_sessions=Sum('sessions_count'),
            total_questions=Sum('questions_attempted'),
            total_correct=Sum('questions_correct'),
            total_time=Sum('total_time_ms')
        )
        
        # 平均正答率
        avg_accuracy = 0
        if total_stats['total_questions'] and total_stats['total_questions'] > 0:
            avg_accuracy = (total_stats['total_correct'] / total_stats['total_questions']) * 100
        
        # 最近のセッション
        recent_sessions = NewQuizSession.objects.filter(
            user=user,
            completed_at__isnull=False
        ).select_related('segment', 'segment__level_id').order_by('-completed_at')[:5]
        
        return Response({
            'total_stats': {
                'total_sessions': total_stats['total_sessions'] or 0,
                'total_questions': total_stats['total_questions'] or 0,
                'total_correct': total_stats['total_correct'] or 0,
                'average_accuracy': round(avg_accuracy, 1),
                'total_time_ms': total_stats['total_time'] or 0,
            },
            'daily_stats': DailyUserStatsSerializer(stats, many=True).data,
            'recent_sessions': QuizSessionListSerializer(recent_sessions, many=True).data
        })
    
    @action(detail=False, methods=['get'])
    def available_content(self, request):
        """利用可能なコンテンツ取得"""
        levels = Level.objects.prefetch_related(
            'segments'
        ).annotate(
            published_segment_count=Count('segments', filter=Q(segments__publish_status='published'))
        ).order_by('created_at')
        
        content = []
        for level in levels:
            if level.published_segment_count > 0:
                segments = level.segments.filter(
                    publish_status='published'
                ).annotate(
                    word_count=Count('segment_words')
                ).order_by('created_at')
                
                content.append({
                    'level': LevelSerializer(level).data,
                    'segments': SegmentListSerializer(segments, many=True).data
                })
        
        return Response(content)


class StatsViewSet(viewsets.ReadOnlyModelViewSet):
    """統計ビューセット"""
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        if self.basename == 'user-stats':
            return NewDailyUserStats.objects.filter(user=self.request.user)
        return NewDailyUserStats.objects.none()
    
    def get_serializer_class(self):
        if self.basename == 'user-stats':
            return DailyUserStatsSerializer
        return DailyUserStatsSerializer
