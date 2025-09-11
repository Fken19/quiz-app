from django.contrib.auth import get_user_model
from django.db.models import Count, Avg, Q, F
from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from datetime import datetime, timedelta
import uuid

from .models import User, Word, WordTranslation, QuizSet, QuizItem, QuizResponse
from .serializers import (
    UserSerializer, WordSerializer, WordTranslationSerializer,
    QuizSetSerializer, QuizItemSerializer, QuizResponseSerializer,
    QuizSetListSerializer, DashboardStatsSerializer
)

User = get_user_model()


class WordViewSet(viewsets.ReadOnlyModelViewSet):
    """単語のビューセット"""
    queryset = Word.objects.all()
    serializer_class = WordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Word.objects.all()
        difficulty = self.request.query_params.get('difficulty')
        if difficulty:
            queryset = queryset.filter(difficulty=difficulty)
        return queryset


class QuizSetViewSet(viewsets.ModelViewSet):
    """クイズセットのビューセット"""
    serializer_class = QuizSetSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return QuizSet.objects.filter(user=self.request.user)

    def get_serializer_class(self):
        if self.action == 'list':
            return QuizSetListSerializer
        return QuizSetSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def start_quiz(self, request, pk=None):
        """クイズを開始する"""
        quiz_set = self.get_object()
        
        # 新しいクイズセッション開始のロジック
        quiz_set.times_attempted += 1
        quiz_set.save()
        
        # クイズアイテムをランダムに選択
        quiz_items = quiz_set.items.order_by('?')[:10]  # 10問
        
        return Response({
            'quiz_set_id': quiz_set.id,
            'items': QuizItemSerializer(quiz_items, many=True).data
        })

    @action(detail=True, methods=['post'])
    def submit_answer(self, request, pk=None):
        """回答を送信する"""
        quiz_set = self.get_object()
        quiz_item_id = request.data.get('quiz_item_id')
        user_answer = request.data.get('answer')
        
        try:
            quiz_item = QuizItem.objects.get(id=quiz_item_id, quiz_set=quiz_set)
        except QuizItem.DoesNotExist:
            return Response(
                {'error': 'クイズアイテムが見つかりません'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 既存の回答をチェック
        existing_response = QuizResponse.objects.filter(
            user=request.user,
            quiz_item=quiz_item
        ).first()
        
        if existing_response:
            return Response(
                {'error': 'この問題には既に回答済みです'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 正解判定
        correct_answer = quiz_item.word.translation_set.first().translation
        is_correct = user_answer.lower().strip() == correct_answer.lower().strip()
        
        # 回答を保存
        quiz_response = QuizResponse.objects.create(
            user=request.user,
            quiz_item=quiz_item,
            user_answer=user_answer,
            is_correct=is_correct,
            response_time=request.data.get('response_time', 0)
        )
        
        return Response({
            'is_correct': is_correct,
            'correct_answer': correct_answer,
            'response_id': quiz_response.id
        })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def google_auth(request):
    """Google認証エンドポイント"""
    google_token = request.data.get('token')
    
    if not google_token:
        return Response(
            {'error': 'Googleトークンが必要です'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # ここでGoogle OAuthトークンを検証する実装を追加
    # 今は簡易実装として、ユーザーが存在しない場合は作成
    email = request.data.get('email')
    name = request.data.get('name')
    
    if not email:
        return Response(
            {'error': 'メールアドレスが必要です'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    user, created = User.objects.get_or_create(
        email=email,
        defaults={'name': name or email.split('@')[0]}
    )
    
    token, created = Token.objects.get_or_create(user=user)
    
    return Response({
        'token': token.key,
        'user': UserSerializer(user).data
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    """ダッシュボード統計データ"""
    user = request.user
    
    # 基本統計
    total_responses = QuizResponse.objects.filter(user=user).count()
    correct_responses = QuizResponse.objects.filter(user=user, is_correct=True).count()
    
    accuracy = (correct_responses / total_responses * 100) if total_responses > 0 else 0
    
    # 今週の統計
    week_ago = timezone.now() - timedelta(days=7)
    weekly_responses = QuizResponse.objects.filter(
        user=user,
        created_at__gte=week_ago
    ).count()
    
    # ストリーク計算（連続正解日数）
    current_streak = 0
    today = timezone.now().date()
    
    # 日別の正解率を計算してストリークを求める
    for i in range(30):  # 過去30日をチェック
        check_date = today - timedelta(days=i)
        daily_responses = QuizResponse.objects.filter(
            user=user,
            created_at__date=check_date
        )
        
        if not daily_responses.exists():
            if i == 0:  # 今日回答がない場合
                continue
            else:
                break
                
        daily_correct = daily_responses.filter(is_correct=True).count()
        daily_total = daily_responses.count()
        
        if daily_total > 0 and (daily_correct / daily_total) >= 0.7:  # 70%以上で継続
            current_streak += 1
        else:
            break
    
    # レベル計算（100問につき1レベル）
    level = total_responses // 100 + 1
    
    # 月間進歩（月初からの改善）
    month_start = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    monthly_responses = QuizResponse.objects.filter(
        user=user,
        created_at__gte=month_start
    )
    
    monthly_accuracy = 0
    if monthly_responses.exists():
        monthly_correct = monthly_responses.filter(is_correct=True).count()
        monthly_accuracy = (monthly_correct / monthly_responses.count() * 100)
    
    # 最近のクイズセット
    recent_quiz_sets = QuizSet.objects.filter(user=user).order_by('-created_at')[:5]
    
    stats_data = {
        'total_quizzes': QuizSet.objects.filter(user=user).count(),
        'average_score': accuracy,
        'current_streak': current_streak,
        'weekly_activity': weekly_responses,
        'level': level,
        'monthly_progress': monthly_accuracy,
        'recent_quiz_sets': QuizSetListSerializer(recent_quiz_sets, many=True).data
    }
    
    return Response(stats_data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def quiz_history(request):
    """クイズ履歴の取得"""
    user = request.user
    
    # フィルター
    difficulty = request.GET.get('difficulty')
    date_range = request.GET.get('date_range')  # 'week', 'month', 'year'
    
    quiz_sets = QuizSet.objects.filter(user=user)
    
    if difficulty:
        quiz_sets = quiz_sets.filter(difficulty=difficulty)
    
    if date_range:
        now = timezone.now()
        if date_range == 'week':
            start_date = now - timedelta(days=7)
        elif date_range == 'month':
            start_date = now - timedelta(days=30)
        elif date_range == 'year':
            start_date = now - timedelta(days=365)
        else:
            start_date = None
            
        if start_date:
            quiz_sets = quiz_sets.filter(created_at__gte=start_date)
    
    quiz_sets = quiz_sets.order_by('-created_at')
    
    # 各クイズセットの統計を含める
    history_data = []
    for quiz_set in quiz_sets:
        responses = QuizResponse.objects.filter(
            user=user,
            quiz_item__quiz_set=quiz_set
        )
        
        total_questions = responses.count()
        correct_answers = responses.filter(is_correct=True).count()
        
        score = (correct_answers / total_questions * 100) if total_questions > 0 else 0
        
        history_data.append({
            'id': quiz_set.id,
            'title': quiz_set.title,
            'difficulty': quiz_set.difficulty,
            'score': round(score, 1),
            'total_questions': total_questions,
            'correct_answers': correct_answers,
            'completed_at': quiz_set.created_at,
            'duration': sum(r.response_time for r in responses) if responses else 0
        })
    
    return Response(history_data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_profile(request):
    """ユーザープロフィール情報"""
    user = request.user
    
    # 統計情報
    total_responses = QuizResponse.objects.filter(user=user).count()
    correct_responses = QuizResponse.objects.filter(user=user, is_correct=True).count()
    
    # お気に入りの難易度
    difficulty_stats = QuizSet.objects.filter(user=user).values('difficulty').annotate(
        count=Count('id')
    ).order_by('-count')
    
    favorite_difficulty = difficulty_stats.first()['difficulty'] if difficulty_stats else 'beginner'
    
    # 平均回答時間
    avg_response_time = QuizResponse.objects.filter(user=user).aggregate(
        avg_time=Avg('response_time')
    )['avg_time'] or 0
    
    profile_data = {
        'user': UserSerializer(user).data,
        'stats': {
            'total_quizzes': QuizSet.objects.filter(user=user).count(),
            'total_questions_answered': total_responses,
            'accuracy_rate': (correct_responses / total_responses * 100) if total_responses > 0 else 0,
            'favorite_difficulty': favorite_difficulty,
            'average_response_time': round(avg_response_time, 2),
            'member_since': user.created_at,
        },
        'achievements': {
            'quiz_master': total_responses >= 1000,
            'accuracy_expert': (correct_responses / total_responses * 100) >= 90 if total_responses > 0 else False,
            'speed_demon': avg_response_time <= 5.0,
            'consistent_learner': True,  # 実装を簡略化
        }
    }
    
    return Response(profile_data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_quiz_set(request):
    """新しいクイズセットを生成"""
    difficulty = request.data.get('difficulty', 'beginner')
    word_count = min(int(request.data.get('word_count', 10)), 20)  # 最大20問
    
    # 指定された難易度の単語をランダムに取得
    words = Word.objects.filter(difficulty=difficulty).order_by('?')[:word_count]
    
    if len(words) < word_count:
        return Response(
            {'error': f'{difficulty}レベルの単語が不足しています'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # クイズセットを作成
    quiz_set = QuizSet.objects.create(
        user=request.user,
        title=f'{difficulty.title()} Quiz - {timezone.now().strftime("%Y/%m/%d %H:%M")}',
        difficulty=difficulty
    )
    
    # クイズアイテムを作成
    for word in words:
        QuizItem.objects.create(
            quiz_set=quiz_set,
            word=word,
            question_text=f"「{word.word}」の意味は？",
            question_type='translation'
        )
    
    return Response({
        'quiz_set': QuizSetSerializer(quiz_set).data,
        'message': f'{word_count}問のクイズセットが作成されました'
    })
