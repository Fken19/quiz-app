from django.contrib.auth import get_user_model
from django.db.models import Count, Avg, Q, F, Sum
from django.db import transaction
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.http import JsonResponse
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from datetime import datetime, timedelta
import uuid
import json
import logging

from .models import User, Word, WordTranslation, QuizSet, QuizItem, QuizResponse
from .serializers import (
    UserSerializer, WordSerializer, WordTranslationSerializer,
    QuizSetSerializer, QuizItemSerializer, QuizResponseSerializer,
    QuizSetListSerializer, DashboardStatsSerializer
)

User = get_user_model()

logger = logging.getLogger(__name__)


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
        if self.request.user.is_anonymous:
            return QuizSet.objects.all()  # テスト用：匿名ユーザーも全てのクイズセットにアクセス可能
        return QuizSet.objects.filter(user=self.request.user)

    def get_serializer_class(self):
        if self.action == 'list':
            return QuizSetListSerializer
        return QuizSetSerializer

    def perform_create(self, serializer):
        # 保存と同時に QuizItem を生成する（トランザクション内）
        from django.db import transaction

        with transaction.atomic():
            quiz_set = serializer.save(user=self.request.user)

            # 作成時の入力値を参照して問題を選択
            level = serializer.validated_data.get('level', getattr(quiz_set, 'level', 1))
            segment = serializer.validated_data.get('segment', getattr(quiz_set, 'segment', 1))
            question_count = serializer.validated_data.get('question_count', getattr(quiz_set, 'question_count', 10))

            words = list(Word.objects.filter(level=level, segment=segment).order_by('?')[:question_count])

            for idx, word in enumerate(words, start=1):
                QuizItem.objects.create(
                    quiz_set=quiz_set,
                    word=word,
                    order=idx
                )

    @action(detail=True, methods=['post'])
    def start_quiz(self, request, pk=None):
        """クイズを開始する"""
        quiz_set = self.get_object()
        
        # 新しいクイズセッション開始のロジック
        quiz_set.times_attempted += 1
        quiz_set.save()
        
        # クイズアイテムをランダムに選択
        quiz_items = quiz_set.quiz_items.order_by('?')[:10]  # 10問
        
        return Response({
            'quiz_set_id': quiz_set.id,
            'items': QuizItemSerializer(quiz_items, many=True).data
        })

    @action(detail=True, methods=['post'], permission_classes=[permissions.AllowAny])
    def submit_answer(self, request, pk=None):
        """回答を送信する"""
        quiz_set = self.get_object()

        quiz_item_id = request.data.get('quiz_item_id')
        selected_translation_id = request.data.get('selected_translation_id')
        reaction_time_ms = int(request.data.get('reaction_time_ms', 0))

        # quiz_item の存在確認
        try:
            quiz_item = QuizItem.objects.get(id=quiz_item_id, quiz_set=quiz_set)
        except QuizItem.DoesNotExist:
            return Response({'error': 'クイズアイテムが見つかりません'}, status=status.HTTP_404_NOT_FOUND)

        # 既存の回答をチェック（同一 quiz_set 内で同一 quiz_item に重複回答がないか）
        existing_response = QuizResponse.objects.filter(quiz_set=quiz_set, quiz_item=quiz_item).first()
        if existing_response:
            return Response({'error': 'この問題には既に回答済みです'}, status=status.HTTP_400_BAD_REQUEST)

        # 選択肢の存在チェック
        try:
            selected_translation = WordTranslation.objects.get(id=selected_translation_id)
        except WordTranslation.DoesNotExist:
            return Response({'error': '選択肢が見つかりません'}, status=status.HTTP_404_NOT_FOUND)

        # 正誤判定: 選択肢が該当の単語に属しており、かつその選択肢が is_correct の場合のみ正解
        is_correct = (selected_translation.word_id == quiz_item.word.id) and bool(selected_translation.is_correct)

        # QuizResponse を作成（匿名ユーザーでも保存する）
        # 既存の DB スキーマに user フィールドが無いことがあるため safe create
        create_kwargs = dict(
            quiz_set=quiz_set,
            quiz_item=quiz_item,
            selected_translation=selected_translation,
            is_correct=is_correct,
            reaction_time_ms=reaction_time_ms
        )
        # user フィールドがモデルに存在すればセット
        if hasattr(QuizResponse, 'user') and not request.user.is_anonymous:
            create_kwargs['user'] = request.user

        quiz_response = QuizResponse.objects.create(**create_kwargs)
        response_id = str(quiz_response.id) if quiz_response else 'unknown'

        return Response({
            'is_correct': is_correct, 
            'response_id': response_id,
            'message': f'正誤判定完了: {"正解" if is_correct else "不正解"}'
        })


@csrf_exempt  # CSRF保護を無効化
@require_http_methods(["POST"])
def google_auth(request):
    """Google認証エンドポイント（プレーンDjango版）"""
    import json
    import base64
    logger.debug('[google_auth] request.META: %s', {k: request.META.get(k) for k in ['REMOTE_ADDR', 'HTTP_USER_AGENT', 'CONTENT_TYPE']})
    
    try:
        # 保守的に生のバイト列も取得して hex 表示で記録する
        raw_body_bytes = request.body if isinstance(request.body, (bytes, bytearray)) else str(request.body).encode('utf-8', errors='replace')
        try:
            raw_hex = raw_body_bytes[:1000].hex()
        except Exception:
            raw_hex = None
        body_text = raw_body_bytes.decode('utf-8', errors='replace')
        logger.debug('[google_auth] raw body (text): %s', body_text[:2000])
        logger.debug('[google_auth] raw body (hex, first 1000 bytes): %s', raw_hex)
        data = json.loads(body_text)
        id_token_string = data.get('id_token')
        logger.debug('[google_auth] received id_token: present=%s length=%s', bool(id_token_string), len(id_token_string) if id_token_string else 0)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    
    if not id_token_string:
        return JsonResponse(
            {'error': 'Google ID token が必要です'},
            status=400
        )
    
    try:
        # 簡易的にJWTデコード（検証スキップ、開発用）
        # 本来はGoogleの公開鍵で署名検証が必要
        import base64
        import binascii

        # id_token のセグメントを取り出す（通常は header.payload.signature の形式）
        try:
            payload_part = id_token_string.split('.')[1]
        except Exception as e:
            logger.exception('[google_auth] id_token split error')
            return JsonResponse({'error': '無効なGoogle ID token 形式'}, status=400)
        # ログ用に payload_part の先頭部分も出す（base64url 文字列）
        logger.debug('[google_auth] payload_part sample: %s', payload_part[:120])
        # URL-safe Base64 (JWT は base64url)、パディングが省略されている場合がある
        padding = '=' * ((4 - len(payload_part) % 4) % 4)
        payload_part_padded = payload_part + padding

        try:
            # urlsafe_b64decode で base64url に対応
            payload_raw_bytes = base64.urlsafe_b64decode(payload_part_padded)
            # payload の生バイト先頭を hex で出す（デバッグ）
            try:
                payload_raw_hex = payload_raw_bytes[:200].hex()
            except Exception:
                payload_raw_hex = None
            logger.debug('[google_auth] payload_raw bytes (hex, first 200): %s', payload_raw_hex)
            payload_text = payload_raw_bytes.decode('utf-8', errors='replace')
            payload = json.loads(payload_text)
            logger.debug('[google_auth] decoded payload keys: %s', list(payload.keys()))
        except (binascii.Error, UnicodeDecodeError, json.JSONDecodeError) as e:
            logger.exception('[google_auth] failed to decode id_token payload')
            return JsonResponse({'error': f'無効なGoogle ID token: {str(e)}'}, status=400)

        email = payload.get('email')
        name = payload.get('name', '')
        
        if not email:
            return JsonResponse(
                {'error': 'メールアドレスが取得できませんでした'},
                status=400
            )
        
        # ユーザー作成または取得
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'username': email,
                'display_name': name,
                'role': 'student'
            }
        )
        
        # APIトークン作成
        token, token_created = Token.objects.get_or_create(user=user)
        
        return JsonResponse({
            'access_token': token.key,
            'expires_in': 3600,  # 1時間
            'user': {
                'id': str(user.id),
                'email': user.email,
                'display_name': user.display_name,
                'role': user.role
            },
            'role': user.role
        })
        
    except (ValueError, KeyError, json.JSONDecodeError) as e:
        logger.exception('[google_auth] invalid token error')
        return JsonResponse(
            {'error': f'無効なGoogle ID token: {str(e)}'},
            status=400
        )
    except Exception as e:
        logger.exception('[google_auth] unexpected error')
        return JsonResponse(
            {'error': f'認証エラー: {str(e)}'},
            status=500
        )


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
    level = request.GET.get('level')
    date_from = request.GET.get('date_from')
    date_to = request.GET.get('date_to')
    sort_by = request.GET.get('sort_by', 'date')
    sort_order = request.GET.get('sort_order', 'desc')
    
    quiz_sets = QuizSet.objects.filter(user=user)
    
    # レベルフィルター
    if level:
        quiz_sets = quiz_sets.filter(level=level)
    
    # 日付フィルター
    if date_from:
        try:
            from_date = timezone.datetime.strptime(date_from, '%Y-%m-%d').date()
            quiz_sets = quiz_sets.filter(created_at__date__gte=from_date)
        except ValueError:
            pass
            
    if date_to:
        try:
            to_date = timezone.datetime.strptime(date_to, '%Y-%m-%d').date()
            quiz_sets = quiz_sets.filter(created_at__date__lte=to_date)
        except ValueError:
            pass
    
    # 完了済みのクイズセットのみ（回答があるもの）
    quiz_sets = quiz_sets.filter(quiz_responses__isnull=False).distinct()
    
    # ソート
    if sort_by == 'date':
        order_field = 'created_at'
    elif sort_by == 'level':
        order_field = 'level'
    else:
        order_field = 'created_at'  # デフォルト
        
    if sort_order == 'desc':
        order_field = '-' + order_field
        
    quiz_sets = quiz_sets.order_by(order_field)
    
    # 各クイズセットの統計を含める
    history_data = []
    for quiz_set in quiz_sets:
        # このクイズセットの全回答を取得
        responses = QuizResponse.objects.filter(quiz_set=quiz_set)
        quiz_items = QuizItem.objects.filter(quiz_set=quiz_set)
        
        total_questions = quiz_items.count()
        total_responses = responses.count()
        correct_answers = responses.filter(is_correct=True).count()
        
        # 完了率チェック
        if total_responses == 0:
            continue
            
        # スコア計算
        score = (correct_answers / total_questions * 100) if total_questions > 0 else 0
        
        # 所要時間計算
        total_duration_ms = responses.aggregate(
            total=Sum('reaction_time_ms')
        )['total'] or 0
        
        # 平均反応時間
        avg_reaction_time_ms = responses.aggregate(
            avg=Avg('reaction_time_ms')
        )['avg'] or 0
        
        # QuizResultフォーマットに合わせたレスポンス
        quiz_result = {
            'quiz_set': {
                'id': str(quiz_set.id),
                'mode': quiz_set.mode,
                'level': quiz_set.level,
                'segment': quiz_set.segment,
                'question_count': quiz_set.question_count,
                'started_at': quiz_set.started_at.isoformat() if quiz_set.started_at else quiz_set.created_at.isoformat(),
                'finished_at': quiz_set.finished_at.isoformat() if quiz_set.finished_at else None,
                'score': round(score)
            },
            'quiz_items': [],  # 詳細は必要時に別途取得
            'quiz_responses': [],  # 詳細は必要時に別途取得
            'total_score': correct_answers,
            'total_questions': total_questions,
            'total_duration_ms': total_duration_ms,
            'average_latency_ms': round(avg_reaction_time_ms)
        }
        
        history_data.append(quiz_result)
    
    # スコアソートの場合は後処理で行う
    if sort_by == 'score':
        reverse = sort_order == 'desc'
        history_data.sort(
            key=lambda x: x['total_score'] / x['total_questions'] if x['total_questions'] > 0 else 0,
            reverse=reverse
        )
    
    return Response(history_data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def user_profile(request):
    """
    ユーザープロフィール情報（GET）および更新（POST: display_name, email, avatar）
    """
    user = request.user

    # POST は更新を受け付ける
    if request.method == 'POST':
        display_name = request.POST.get('display_name')
        email = request.POST.get('email')
        avatar_file = request.FILES.get('avatar')

        changed = False
        original_avatar = user.avatar
        
        if display_name is not None and display_name != user.display_name:
            user.display_name = display_name
            changed = True
            
        if email is not None and email != user.email:
            user.email = email
            changed = True
            
        if avatar_file is not None:
            # avatar ImageField が存在すれば保存
            try:
                user.avatar = avatar_file
                changed = True
            except Exception as e:
                # avatar フィールドが無い場合はavatar_urlフィールドに保存を試みる
                try:
                    # 一時的にファイルを保存してURLを生成
                    import os
                    from django.core.files.storage import default_storage
                    file_name = f"avatars/{user.id}_{avatar_file.name}"
                    file_path = default_storage.save(file_name, avatar_file)
                    user.avatar_url = request.build_absolute_uri(default_storage.url(file_path))
                    changed = True
                except Exception:
                    pass

        if changed:
            user.save()
            # 更新後のユーザー情報をシリアライザーで返す
            return Response({
                'success': True,
                'message': 'プロフィールが更新されました',
                'user': UserSerializer(user, context={'request': request}).data
            })

        return Response({
            'success': False,
            'message': '変更はありませんでした',
            'user': UserSerializer(user, context={'request': request}).data
        })

    # GET は従来のプロフィールデータを返す
    total_responses = QuizResponse.objects.filter(quiz_set__user=user).count()
    correct_responses = QuizResponse.objects.filter(quiz_set__user=user, is_correct=True).count()

    difficulty_stats = QuizSet.objects.filter(user=user).values('level').annotate(
        count=Count('id')
    ).order_by('-count')

    favorite_level = difficulty_stats.first()['level'] if difficulty_stats else 1

    avg_response_time = QuizResponse.objects.filter(quiz_set__user=user).aggregate(
        avg_time=Avg('reaction_time_ms')
    )['avg_time'] or 0

    profile_data = {
        'user': UserSerializer(user, context={'request': request}).data,
        'stats': {
            'total_quizzes': QuizSet.objects.filter(user=user).count(),
            'total_questions_answered': total_responses,
            'accuracy_rate': (correct_responses / total_responses * 100) if total_responses > 0 else 0,
            'favorite_level': favorite_level,
            'average_response_time': round(avg_response_time / 1000, 2) if avg_response_time else 0,  # ms を秒に変換
            'member_since': user.created_at,
        },
        'achievements': {
            'quiz_master': total_responses >= 1000,
            'accuracy_expert': (correct_responses / total_responses * 100) >= 90 if total_responses > 0 else False,
            'speed_demon': (avg_response_time / 1000) <= 5.0 if avg_response_time else False,  # 5秒以下
            'consistent_learner': True,  # 実装を簡略化
        }
    }

    # debug: log profile_data for verification of avatar_url
    try:
        import logging
        logging.getLogger('quiz.middleware').info('Profile GET response: %s', profile_data)
    except Exception:
        pass

    return Response(profile_data)


@api_view(['GET'])
@permission_classes([AllowAny])  # 一時的にパーミッション緩和
def quiz_result(request, quiz_set_id):
    """クイズ結果を取得する"""
    try:
        quiz_set = get_object_or_404(QuizSet, id=quiz_set_id)
        
        # クイズセットに関連するクイズアイテムと回答を取得
        quiz_items = QuizItem.objects.filter(quiz_set=quiz_set).order_by('order')
        quiz_responses = QuizResponse.objects.filter(quiz_set=quiz_set).order_by('quiz_item__order')
        
        # スコア計算
        total_questions = quiz_items.count()
        total_correct = quiz_responses.filter(is_correct=True).count()
        score_percentage = round((total_correct / total_questions * 100)) if total_questions > 0 else 0
        
        # 回答時間統計
        total_duration_ms = quiz_responses.aggregate(
            total=Sum('reaction_time_ms')
        )['total'] or 0
        
        average_latency_ms = quiz_responses.aggregate(
            avg=Avg('reaction_time_ms')
        )['avg'] or 0
        
        # データ構築
        items_data = []
        responses_data = []
        
        for item in quiz_items:
            # 各問題の翻訳選択肢を取得
            translations = WordTranslation.objects.filter(word=item.word)
            
            items_data.append({
                'id': str(item.id),
                'quiz_set_id': str(quiz_set.id),
                'word_id': str(item.word.id),
                'word': {
                    'id': str(item.word.id),
                    'text': item.word.text,
                    'pos': getattr(item.word, 'pos', 'unknown'),  # posがない場合はデフォルト値
                    'level': item.word.level,
                    'tags': []  # 必要に応じて実装
                },
                'translations': [
                    {
                        'id': str(t.id),
                        'word_id': str(t.word_id),
                        'ja': t.text,
                        'is_correct': t.is_correct
                    } for t in translations
                ],
                'order_no': item.order
            })
        
        for response in quiz_responses:
            responses_data.append({
                'id': str(response.id),
                'quiz_item_id': str(response.quiz_item.id),
                'user_id': 'anonymous',  # userフィールドがQuizResponseにない場合のため
                'chosen_translation_id': str(response.selected_translation.id),
                'is_correct': response.is_correct,
                'latency_ms': response.reaction_time_ms,
                'answered_at': response.created_at.isoformat()
            })
        
        result_data = {
            'quiz_set': {
                'id': str(quiz_set.id),
                'mode': quiz_set.mode,
                'level': quiz_set.level,
                'segment': quiz_set.segment,
                'question_count': quiz_set.question_count,
                'started_at': quiz_set.started_at.isoformat() if quiz_set.started_at else quiz_set.created_at.isoformat(),
                'finished_at': quiz_set.finished_at.isoformat() if quiz_set.finished_at else timezone.now().isoformat(),
                'score': score_percentage
            },
            'quiz_items': items_data,
            'quiz_responses': responses_data,
            'total_score': total_correct,
            'total_questions': total_questions,
            'total_duration_ms': total_duration_ms,
            'average_latency_ms': round(average_latency_ms)
        }
        
        return Response(result_data)
        
    except Exception as e:
        logger.error(f'Error fetching quiz result: {str(e)}')
        return Response(
            {'error': f'クイズ結果の取得に失敗しました: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_quiz_set(request):
    """新しいクイズセットを生成"""
    # フロントからは { level, segment, mode, question_count } を期待
    level = int(request.data.get('level', 1))
    segment = int(request.data.get('segment', 1))
    mode = request.data.get('mode', 'default')
    question_count = min(int(request.data.get('question_count', 10)), 50)  # 上限50問

    # デバッグログ: 受け取ったリクエストデータ
    try:
        print(f"[generate_quiz_set] request.data={request.data}")
    except Exception as e:
        print(f"[generate_quiz_set] failed to print request.data: {e}")

    # 指定されたレベル・セグメントの単語をランダムに取得
    words = list(Word.objects.filter(level=level, segment=segment).order_by('?')[:question_count])

    print(f"[generate_quiz_set] selected_words_count={len(words)} (requested={question_count}, level={level}, segment={segment})")

    if len(words) < question_count:
        return Response(
            {'error': f'L{level}-S{segment} の単語が不足しています (必要: {question_count}、見つかった: {len(words)})'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # クイズセットを作成
    quiz_set = QuizSet.objects.create(
        user=request.user,
        title=f'L{level}-S{segment} Quiz - {timezone.now().strftime("%Y/%m/%d %H:%M")}',
        mode=mode,
        level=level,
        segment=segment,
        question_count=question_count
    )

    # クイズアイテムを作成（順序を付与）
    for idx, word in enumerate(words, start=1):
        try:
            QuizItem.objects.create(
                quiz_set=quiz_set,
                word=word,
                order=idx
            )
        except Exception as e:
            print(f"[generate_quiz_set] failed to create QuizItem for word={getattr(word, 'id', None)}: {e}")
            # 続行して残りの単語を試す
            continue

    return Response({
        'quiz_set': QuizSetSerializer(quiz_set).data,
        'message': f'{question_count}問のクイズセットが作成されました'
    })


import json

@csrf_exempt
@require_http_methods(["POST"])
def google_auth_simple(request):
    """シンプルなGoogle認証テスト（DRF使わない）"""
    try:
        data = json.loads(request.body)
        id_token = data.get('id_token')
        
        if not id_token:
            return JsonResponse({'error': 'id_token required'}, status=400)
            
        # ダミーレスポンス（テスト用）
        return JsonResponse({
            'status': 'success',
            'message': 'Google auth endpoint is working',
            'access_token': 'dummy_token_123'
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)
