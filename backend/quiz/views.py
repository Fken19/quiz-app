from django.contrib.auth import get_user_model
from django.db.models import Count, Avg, Q, F, Sum
from django.db.models import Case, When, IntegerField
from django.db.models.functions import TruncDate, TruncWeek, TruncMonth
from django.db import transaction, connection
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
from collections import defaultdict, deque

from .models import (
    User, Word, WordTranslation, QuizSet, QuizItem, QuizResponse,
    InviteCode, TeacherStudentLink
)
from .serializers import (
    UserSerializer, WordSerializer, WordTranslationSerializer,
    QuizSetSerializer, QuizItemSerializer, QuizResponseSerializer,
    QuizSetListSerializer, QuizSetCreateSerializer, DashboardStatsSerializer,
    InviteCodeSerializer, CreateInviteCodeSerializer, AcceptInviteCodeSerializer,
    TeacherStudentLinkSerializer
)
from .utils import is_teacher_whitelisted

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
        elif self.action == 'create':
            return QuizSetCreateSerializer
        return QuizSetSerializer

    def create(self, request, *args, **kwargs):
        """クイズセット作成時は、作成直後の詳細情報（id 等）を返す"""
        # Create 用シリアライザでバリデーション
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # perform_create 内で QuizItem も作成され、serializer.instance にインスタンスが格納される
        self.perform_create(serializer)

        created_instance = getattr(serializer, 'instance', None)
        # 念のためDBから再取得
        if created_instance is None:
            return Response({'detail': 'Failed to create quiz set'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # 詳細シリアライザで返す（id を含む）
        detail_serializer = QuizSetSerializer(created_instance, context=self.get_serializer_context())
        headers = self.get_success_headers(detail_serializer.data)
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        # 保存と同時に QuizItem を生成する（トランザクション内）
        from django.db import transaction

        with transaction.atomic():
            quiz_set = serializer.save(user=self.request.user)
            # DRFは save() 後に serializer.instance に設定するが、念のため保証
            try:
                if getattr(serializer, 'instance', None) is None:
                    serializer.instance = quiz_set
            except Exception:
                pass

            # 作成時の入力値を参照して問題を選択
            level = serializer.validated_data.get('level', getattr(quiz_set, 'level', 1))
            segment = serializer.validated_data.get('segment', getattr(quiz_set, 'segment', 1))
            question_count = serializer.validated_data.get('question_count', getattr(quiz_set, 'question_count', 10))

            words = list(Word.objects.filter(grade=level).order_by('?')[:question_count])

            for idx, word in enumerate(words, start=1):
                # 正答を取得
                correct_translation = word.translations.filter(is_correct=True).first()
                correct_answer = correct_translation.text if correct_translation else word.text
                
                # 選択肢を生成（正答 + 3つのダミー選択肢）
                all_translations = list(word.translations.all()[:4])  # 最大4つの選択肢
                if len(all_translations) < 4:
                    # 他の単語からダミー選択肢を取得
                    dummy_translations = WordTranslation.objects.exclude(
                        word=word
                    ).order_by('?')[:4-len(all_translations)]
                    all_translations.extend(dummy_translations)
                
                choices = [{"text": t.text, "is_correct": t.word_id == word.id and t.is_correct} for t in all_translations]
                
                QuizItem.objects.create(
                    quiz_set=quiz_set,
                    word=word,
                    question_number=idx,
                    choices=choices,  # JSON形式で選択肢を保存
                    correct_answer=correct_answer
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

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def submit_answer(self, request, pk=None):
        """回答を送信する"""
        quiz_set = self.get_object()

        quiz_item_id = request.data.get('quiz_item_id')
        selected_translation_id = request.data.get('selected_translation_id')
        selected_answer_text = request.data.get('selected_answer_text')
        reaction_time_ms = int(request.data.get('reaction_time_ms', 0))

        # quiz_item の存在確認
        try:
            quiz_item = QuizItem.objects.get(id=quiz_item_id, quiz_set=quiz_set)
        except QuizItem.DoesNotExist:
            return Response({'error': 'クイズアイテムが見つかりません'}, status=status.HTTP_404_NOT_FOUND)

        # 既存の回答をチェック（quiz_item に重複回答がないか）
        # DBスキーマ上はquiz_item_idがユニークなので、既存の回答があるかチェック
        existing_response = QuizResponse.objects.filter(quiz_item=quiz_item).first()
        if existing_response:
            return Response({'error': 'この問題には既に回答済みです'}, status=status.HTTP_400_BAD_REQUEST)

        is_correct = False
        chosen_text = None

        # 1) 通常ルート: translation ID が数値で取得できる場合
        selected_id_int = None
        try:
            if selected_translation_id is not None:
                selected_id_int = int(selected_translation_id)
        except (TypeError, ValueError):
            selected_id_int = None

        if selected_id_int is not None:
            try:
                selected_translation = WordTranslation.objects.get(id=selected_id_int)
                chosen_text = selected_translation.text
                # 正誤判定: 同一単語かつ is_correct
                is_correct = (selected_translation.word_id == quiz_item.word.id) and bool(selected_translation.is_correct)
            except WordTranslation.DoesNotExist:
                return Response({'error': '選択肢が見つかりません'}, status=status.HTTP_404_NOT_FOUND)
        else:
            # 2) フォールバック: テキストでの判定（QuizItem.choices か correct_answer を利用）
            chosen_text = (selected_answer_text or '').strip()
            if not chosen_text:
                return Response({'error': '選択内容が不正です'}, status=status.HTTP_400_BAD_REQUEST)
            # choices に一致があればその is_correct を優先
            try:
                choices = quiz_item.choices or []
                match = next((c for c in choices if c.get('text') == chosen_text), None)
                if match is not None:
                    is_correct = bool(match.get('is_correct', False))
                else:
                    # 最後の手段: correct_answer と文字列一致
                    is_correct = (chosen_text == (quiz_item.correct_answer or ''))
            except Exception:
                is_correct = (chosen_text == (quiz_item.correct_answer or ''))

        # QuizResponse を作成（新しいスキーマに対応）
        create_kwargs = dict(
            quiz_item=quiz_item,
            selected_answer=chosen_text or "Unknown",
            is_correct=is_correct,
            reaction_time_ms=reaction_time_ms,
            user=request.user
        )

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
        try:
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'username': email,
                    'display_name': name,
                    'role': 'student'
                }
            )
        except User.MultipleObjectsReturned:
            # 重複レコードが既にある場合は最初の1件を採用して継続（非破壊）
            logger.warning(f"Multiple users returned for email={email}; using first match")
            user = User.objects.filter(email=email).order_by('id').first()
            created = False
        
        # ホワイトリストチェックに基づいてロールを自動設定
        if is_teacher_whitelisted(email):
            if user.role != 'teacher':
                logger.info(f"Updating user {email} role to teacher (whitelisted)")
                user.role = 'teacher'
                user.save(update_fields=['role'])
        else:
            if user.role == 'teacher':
                logger.info(f"Updating user {email} role to student (not whitelisted)")
                user.role = 'student'
                user.save(update_fields=['role'])
        
        # 表示名を更新（もし変更されていれば）
        if user.display_name != name and name:
            user.display_name = name
            user.save(update_fields=['display_name'])
        
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
def learning_metrics(request):
    """
    学習ダッシュボード用メトリクス
    - 日/週/月の積み上げ棒グラフ用データ（正解/不正解/Timeout）
    - Streak（連続達成日数: その日の正解率>=70%）
    - 直近7日ヒートマップ（総回答数/正解数）
    """
    user = request.user
    now = timezone.now()

    # ユーザーの回答
    base_qs = QuizResponse.objects.filter(user=user)

    # Timeout の定義: 不正解 かつ (reaction_time_ms が 0 or NULL or selected_answer='Unknown')
    timeout_expr = Case(
        When(Q(is_correct=False) & (Q(reaction_time_ms__isnull=True) | Q(reaction_time_ms=0) | Q(selected_answer='Unknown')), then=1),
        default=0,
        output_field=IntegerField()
    )
    incorrect_non_timeout_expr = Case(
        When(Q(is_correct=False) & ~ (Q(reaction_time_ms__isnull=True) | Q(reaction_time_ms=0) | Q(selected_answer='Unknown')), then=1),
        default=0,
        output_field=IntegerField()
    )
    correct_expr = Case(
        When(is_correct=True, then=1),
        default=0,
        output_field=IntegerField()
    )

    def aggregate_by(trunc_func, qs):
        grouped = (
            qs.annotate(bucket=trunc_func('created_at'))
              .values('bucket')
              .annotate(
                  correct=Sum(correct_expr),
                  incorrect=Sum(incorrect_non_timeout_expr),
                  timeout=Sum(timeout_expr),
                  total=Count('id')
              )
              .order_by('bucket')
        )
        out = []
        for row in grouped:
            b = row['bucket']
            out.append({
                'bucket': b.isoformat() if hasattr(b, 'isoformat') else str(b),
                'correct': row['correct'] or 0,
                'incorrect': row['incorrect'] or 0,
                'timeout': row['timeout'] or 0,
                'total': row['total'] or 0,
            })
        return out

    # 期間フィルタ（要件）
    last_15_days = now - timezone.timedelta(days=15)
    last_8_weeks = now - timezone.timedelta(weeks=8)
    last_12_months = now - timezone.timedelta(days=365)

    daily = aggregate_by(TruncDate, base_qs.filter(created_at__gte=last_15_days))
    weekly = aggregate_by(TruncWeek, base_qs.filter(created_at__gte=last_8_weeks))
    monthly = aggregate_by(TruncMonth, base_qs.filter(created_at__gte=last_12_months))

    # Streak: 直近から遡って、その日に1件でも回答があれば連続カウント
    streak = 0
    # 過去90日分を計算ベースに
    max_days = 90
    for i in range(max_days):
        day = (now - timezone.timedelta(days=i)).date()
        day_qs = base_qs.filter(created_at__date=day)
        if not day_qs.exists():
            if i == 0:
                # 今日が未回答でも streak は継続可能性ありなのでスキップ
                continue
            break
        # その日に1件でも回答があればOK
        streak += 1

    # 直近7日ヒートマップ
    heatmap7 = []
    for i in range(6, -1, -1):
        day = (now - timezone.timedelta(days=i)).date()
        day_qs = base_qs.filter(created_at__date=day)
        total = day_qs.count()
        correct = day_qs.filter(is_correct=True).count()
        heatmap7.append({
            'date': day.isoformat(),
            'total': total,
            'correct': correct,
        })

    return Response({
        'daily': daily,
        'weekly': weekly,
        'monthly': monthly,
        'streak': streak,
        'heatmap7': heatmap7,
    })


def _fetch_last_two_by_word(user_id, word_ids):
    """DB側（PostgreSQLウィンドウ関数）で各単語ごと最新2件の回答を取得
    戻り値: { word_id: [ {is_correct, reaction_time_ms, selected_answer}, ...最新→過去 ] }
    """
    result = {}
    if not word_ids:
        return result
    # 動的プレースホルダを生成
    placeholders = ','.join(['%s'] * len(word_ids))
    params = [user_id] + list(word_ids)
    sql = f"""
        WITH ranked AS (
            SELECT
                r.id,
                qi.word_id AS word_id,
                r.is_correct AS is_correct,
                r.response_time_ms AS reaction_time_ms,
                r.selected_answer AS selected_answer,
                r.created_at AS created_at,
                ROW_NUMBER() OVER (PARTITION BY qi.word_id ORDER BY r.created_at DESC) AS rn
            FROM quiz_quiz_response r
            JOIN quiz_quiz_item qi ON r.quiz_item_id = qi.id
            WHERE r.user_id = %s AND qi.word_id IN ({placeholders})
        )
        SELECT word_id, is_correct, reaction_time_ms, selected_answer, rn
        FROM ranked
        WHERE rn <= 2
        ORDER BY word_id, rn
    """
    with connection.cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()
        # rows: (word_id, is_correct, reaction_time_ms, selected_answer, rn) with rn=1 latest
        for word_id, is_correct, reaction_time_ms, selected_answer, rn in rows:
            lst = result.setdefault(int(word_id), [])
            # rn=1 が先頭（最新）になるようにappend。ORDER BY rn 昇順なので先に最新が来る
            lst.append({
                'is_correct': bool(is_correct),
                'reaction_time_ms': reaction_time_ms,
                'selected_answer': selected_answer or ''
            })
    return result


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def focus_status_counts(request):
    """
    フォーカス学習用のステータス別件数を返す。
    クエリ:
      - level: int | 'all' （未指定はユーザのlevel_preference）
    ルール（直近履歴ベース／相互排他）:
      - 未学習: QuizResponse がまだない
      - 苦手: 直近1回が不正解 or Timeout（Timeout=不正解 かつ 反応時間0/NULL or Unknown）
      - 学習済み: 直近1回は正解 だが 直近2回連続正解ではない
      - 得意: 直近2回が連続正解
    返却: { level_counts: { level: {unseen, weak, learned, strong} }, total: {...} }
    """
    user = request.user
    level_param = request.query_params.get('level')
    levels = []
    if level_param in (None, '', 'auto'):
        levels = [int(getattr(user, 'level_preference', 1) or 1)]
    elif level_param == 'all':
        # 既存のWordのgradeから存在するレベルを拾う（上限5程度）
        levels = list(
            Word.objects.values_list('grade', flat=True).distinct().order_by('grade')[:50]
        )
    else:
        try:
            levels = [int(level_param)]
        except ValueError:
            return Response({'error': 'invalid level parameter'}, status=status.HTTP_400_BAD_REQUEST)

    # 全対象単語IDを取得（レベル別に）
    words_by_level = {
        lv: list(Word.objects.filter(grade=lv).values_list('id', flat=True)) for lv in levels
    }

    # 全対象単語ID集合
    all_word_ids = set()
    for arr in words_by_level.values():
        all_word_ids.update(arr)
    if not all_word_ids:
        return Response({'level_counts': {lv: {'unseen': 0, 'weak': 0, 'learned': 0, 'strong': 0} for lv in levels}, 'total': {'unseen': 0, 'weak': 0, 'learned': 0, 'strong': 0}})
    # DB側で各単語ごと最新2件のみ取得
    last_two_by_word = _fetch_last_two_by_word(user.id, list(all_word_ids))

    def is_timeout(rec):
        return (not rec['is_correct']) and (
            rec['reaction_time_ms'] in (None, 0) or rec['selected_answer'] == 'Unknown'
        )

    def classify(word_id: int) -> str:
        arr = last_two_by_word.get(word_id)
        if not arr or len(arr) == 0:
            return 'unseen'
        # 直近1件は配列の先頭（rn=1）
        last = arr[0]
        if (not last['is_correct']) or is_timeout(last):
            return 'weak'
        # 直近1回が正解
        if len(arr) >= 2 and arr[1]['is_correct'] and (not is_timeout(arr[1])):
            return 'strong'
        return 'learned'

    result = {}
    total = {'unseen': 0, 'weak': 0, 'learned': 0, 'strong': 0}
    for lv, word_ids in words_by_level.items():
        counts = {'unseen': 0, 'weak': 0, 'learned': 0, 'strong': 0}
        for wid in word_ids:
            c = classify(wid)
            counts[c] += 1
        result[lv] = counts
        for k in total:
            total[k] += counts[k]

    return Response({'level_counts': result, 'total': total})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def focus_start(request):
    """
    フォーカス学習を開始してクイズセットを生成。
    入力(JSON): { status: 'unseen'|'weak'|'learned'|'strong', level: int|'all', count?: int=10,
                   extend?: boolean, extend_levels?: [int], pos_filter?: [str] }
    仕様:
      - まず選択レベル内で指定statusの単語を抽出。
      - 足りなければ extend=true の場合、extend_levels（指定がなければ全レベル）で補完。
      - それでも足りなければ足りない件数を明示しつつ、そのまま開始可能。
    戻り値: { requested: n, available: m, started: boolean, message, quiz_set?: QuizSetSerializer }
    """
    user = request.user
    body = request.data or {}
    status_key = body.get('status')
    level_param = body.get('level')
    target_count = int(body.get('count', 10))
    extend = bool(body.get('extend', False))
    extend_levels = body.get('extend_levels')

    if status_key not in ('unseen', 'weak', 'learned', 'strong'):
        return Response({'error': 'invalid status'}, status=status.HTTP_400_BAD_REQUEST)

    # レベル集合決定
    if level_param in (None, '', 'auto'):
        base_levels = [int(getattr(user, 'level_preference', 1) or 1)]
    elif str(level_param) == 'all':
        base_levels = list(Word.objects.values_list('grade', flat=True).distinct())
    else:
        try:
            base_levels = [int(level_param)]
        except ValueError:
            return Response({'error': 'invalid level parameter'}, status=status.HTTP_400_BAD_REQUEST)

    if extend and not extend_levels:
        extend_levels = list(Word.objects.values_list('grade', flat=True).distinct())

    # 対象候補単語IDを列挙する関数（focus_status_counts と同ロジック）
    def collect_ids_for_levels(levels_list):
        words_by_level = {
            lv: list(Word.objects.filter(grade=lv).values_list('id', flat=True)) for lv in levels_list
        }
        all_ids = set()
        for ids in words_by_level.values():
            all_ids.update(ids)

        last_two_by_word = _fetch_last_two_by_word(user.id, list(all_ids))

        def is_timeout(rec):
            return (not rec['is_correct']) and (
                rec['reaction_time_ms'] in (None, 0) or rec['selected_answer'] == 'Unknown'
            )

        def classify(word_id: int) -> str:
            arr = last_two_by_word.get(word_id)
            if not arr or len(arr) == 0:
                return 'unseen'
            last = arr[0]
            if (not last['is_correct']) or is_timeout(last):
                return 'weak'
            if len(arr) >= 2 and arr[1]['is_correct'] and (not is_timeout(arr[1])):
                return 'strong'
            return 'learned'

        # 指定 status のものだけ集める
        candidates = [wid for wid in all_ids if classify(wid) == status_key]
        return candidates

    # まずベースレベルから
    candidate_ids = collect_ids_for_levels(base_levels)
    available_base = len(candidate_ids)

    # 足りなければ拡張（extend_levelsの中で base_levels に無いものを追加）
    if available_base < target_count and extend and extend_levels:
        extra_levels = [lv for lv in extend_levels if lv not in base_levels]
        extra_ids = collect_ids_for_levels(extra_levels)
        candidate_ids = list(candidate_ids) + [wid for wid in extra_ids if wid not in candidate_ids]

    available_total = len(candidate_ids)

    # 候補が0の場合は開始せず件数のみ返す
    if available_total == 0:
        return Response({
            'requested': target_count,
            'available': 0,
            'started': False,
            'message': f"選択された条件（status={status_key}）に該当する単語がありません"
        })

    # ランダム抽出（重複なし）
    import random
    random.shuffle(candidate_ids)
    selected_word_ids = candidate_ids[:target_count]

    # QuizSet を作って QuizItem を単語から生成（pos_filterは現状未使用）
    with transaction.atomic():
        quiz_set = QuizSet.objects.create(
            user=user,
            name=f"Focus {status_key} ({'all' if str(level_param)=='all' else ','.join(map(str, base_levels))})",
            grade=base_levels[0] if base_levels else 1,
            total_questions=len(selected_word_ids),
            pos_filter={'focus': status_key}
        )

        # 各単語に対して QuizItem を作成
        words = list(Word.objects.filter(id__in=selected_word_ids))
        # id の順ではなくランダム順を保ったまま order を振る
        wid_to_word = {w.id: w for w in words}
        for idx, wid in enumerate(selected_word_ids, start=1):
            word = wid_to_word.get(wid)
            if not word:
                continue
            correct_translation = word.translations.filter(is_correct=True).first()
            correct_answer = correct_translation.text if correct_translation else word.text
            # 選択肢（正答 + ダミー）
            all_translations = list(word.translations.all()[:4])
            if len(all_translations) < 4:
                dummy_translations = WordTranslation.objects.exclude(word=word).order_by('?')[:4 - len(all_translations)]
                all_translations.extend(dummy_translations)
            choices = [{"text": t.text, "is_correct": (t.word_id == word.id and t.is_correct)} for t in all_translations]

            QuizItem.objects.create(
                quiz_set=quiz_set,
                word=word,
                question_number=idx,
                choices=choices,
                correct_answer=correct_answer,
            )

    return Response({
        'requested': target_count,
        'available': available_total,
        'started': True,
        'message': f"{min(target_count, available_total)}問で開始します（要求{target_count}問、対象{available_total}問）",
        'quiz_set': QuizSetSerializer(quiz_set, context={'request': request}).data
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def quiz_history(request):
    """クイズ履歴の取得"""
    user = request.user
    
    # デバッグ用：まずは基本的なクエリで試す
    try:
        quiz_sets = QuizSet.objects.filter(user=user).order_by('-created_at')[:10]
        
        # 単純なレスポンスを返す
        history_data = []
        for quiz_set in quiz_sets:
            history_data.append({
                'quiz_set': {
                    'id': str(quiz_set.id),
                    'mode': quiz_set.mode,
                    'level': quiz_set.level,
                    'segment': quiz_set.segment,
                    'question_count': quiz_set.question_count,
                    'created_at': quiz_set.created_at.isoformat(),
                    'score': quiz_set.score
                },
                'total_questions': quiz_set.question_count,
                'total_score': quiz_set.score,
                'total_duration_ms': 0,
                'average_latency_ms': 0
            })
        
        return Response(history_data)
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Quiz history error: {e}")
        return Response({'error': str(e)}, status=500)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def user_profile(request):
    """
    ユーザープロフィール情報（GET）および更新（POST: display_name, email, avatar）
    """
    user = request.user
    
    # ホワイトリストチェックに基づいてロールを自動更新
    if user.email:
        if is_teacher_whitelisted(user.email):
            if user.role != 'teacher':
                logger.info(f"Updating user {user.email} role to teacher (whitelisted)")
                user.role = 'teacher'
                user.save(update_fields=['role'])
        else:
            if user.role == 'teacher':
                logger.info(f"Updating user {user.email} role to student (not whitelisted)")
                user.role = 'student'
                user.save(update_fields=['role'])

    # POST は更新を受け付ける
    if request.method == 'POST':
        display_name = request.POST.get('display_name')
        email = request.POST.get('email')
        organization = request.POST.get('organization')
        bio = request.POST.get('bio')
        avatar_file = request.FILES.get('avatar')

        changed = False
        original_avatar = user.avatar
        
        if display_name is not None and display_name != user.display_name:
            user.display_name = display_name
            changed = True
            
        if email is not None and email != user.email:
            user.email = email
            changed = True

        if organization is not None and organization != getattr(user, 'organization', ''):
            user.organization = organization
            changed = True

        if bio is not None and bio != getattr(user, 'bio', ''):
            user.bio = bio
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
    total_responses = QuizResponse.objects.filter(user=user).count()
    correct_responses = QuizResponse.objects.filter(user=user, is_correct=True).count()

    difficulty_stats = QuizSet.objects.filter(user=user).values('grade').annotate(
        count=Count('id')
    ).order_by('-count')

    favorite_level = difficulty_stats.first()['grade'] if difficulty_stats else 1

    avg_response_time = QuizResponse.objects.filter(user=user).aggregate(
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
        quiz_items = QuizItem.objects.filter(quiz_set=quiz_set).order_by('question_number')
        quiz_responses = QuizResponse.objects.filter(quiz_item__quiz_set=quiz_set).order_by('quiz_item__question_number')

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
                    'level': item.word.grade,  # gradeフィールドを使用
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
                'user_id': str(response.user.id) if getattr(response, 'user', None) else None,
                'chosen_translation_text': response.selected_answer,
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


# 講師権限チェック用デコレータ
class IsTeacherPermission(permissions.BasePermission):
    """講師権限チェック"""
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return (request.user.is_teacher and 
                is_teacher_whitelisted(request.user.email))


# 講師用API Views
class TeacherInviteCodeViewSet(viewsets.ModelViewSet):
    """講師用招待コード管理API"""
    serializer_class = InviteCodeSerializer
    permission_classes = [IsTeacherPermission]
    
    def get_queryset(self):
        return InviteCode.objects.filter(issued_by=self.request.user).order_by('-issued_at')
    
    def create(self, request):
        """招待コード発行"""
        serializer = CreateInviteCodeSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            codes = serializer.save()
            return Response({
                'codes': InviteCodeSerializer(codes, many=True).data,
                'message': f'{len(codes)}件の招待コードを発行しました'
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None):
        """招待コード失効"""
        invite_code = self.get_object()
        invite_code.revoked = True
        invite_code.revoked_at = timezone.now()
        invite_code.save()
        
        return Response({
            'message': f'招待コード {invite_code.code} を失効しました'
        })


class TeacherStudentViewSet(viewsets.ReadOnlyModelViewSet):
    """講師用生徒管理API"""
    serializer_class = TeacherStudentLinkSerializer
    permission_classes = [IsTeacherPermission]
    
    def get_queryset(self):
        return TeacherStudentLink.objects.filter(
            teacher=self.request.user
        ).exclude(status='revoked').order_by('-linked_at')
    
    def list(self, request):
        """生徒一覧（status でフィルタ可能）"""
        queryset = self.get_queryset()
        
        # status パラメータでフィルタ
        status_filter = request.query_params.get('status')
        if status_filter in ['pending', 'active']:
            queryset = queryset.filter(status=status_filter)
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['delete'])
    def revoke(self, request, pk=None):
        """生徒との紐付け解除"""
        link = self.get_object()
        link.status = 'revoked'
        link.revoked_at = timezone.now()
        link.revoked_by = request.user
        link.save()
        
        return Response({
            'message': f'{link.student.display_name or link.student.email} との紐付けを解除しました'
        })


# 生徒用API Views
class StudentInviteCodeView(viewsets.GenericViewSet):
    """生徒用招待コード受諾API"""
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['post'])
    def accept(self, request):
        """招待コード受諾（紐付け作成）"""
        serializer = AcceptInviteCodeSerializer(data=request.data)
        if serializer.is_valid():
            invite_code = serializer.validated_data['invite_code']
            
            # 既存の紐付けチェック
            existing_link = TeacherStudentLink.objects.filter(
                teacher=invite_code.issued_by,
                student=request.user,
                status__in=['active', 'pending']
            ).first()
            
            if existing_link:
                return Response({
                    'error': 'この講師との紐付けは既に存在します'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 招待コードを使用済みにして紐付け作成
            with transaction.atomic():
                invite_code.used_by = request.user
                invite_code.used_at = timezone.now()
                invite_code.save()
                
                link = TeacherStudentLink.objects.create(
                    teacher=invite_code.issued_by,
                    student=request.user,
                    status='active',
                    invite_code=invite_code
                )
            
            return Response({
                'message': f'{invite_code.issued_by.display_name or invite_code.issued_by.email} との紐付けが完了しました',
                'link': TeacherStudentLinkSerializer(link).data
            }, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class StudentTeacherViewSet(viewsets.ReadOnlyModelViewSet):
    """生徒用講師管理API"""
    serializer_class = TeacherStudentLinkSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return TeacherStudentLink.objects.filter(
            student=self.request.user,
            status='active'
        ).order_by('-linked_at')
    
    @action(detail=True, methods=['delete'])
    def revoke(self, request, pk=None):
        """講師との紐付け解除"""
        link = self.get_object()
        link.status = 'revoked'
        link.revoked_at = timezone.now()
        link.revoked_by = request.user
        link.save()
        
        return Response({
            'message': f'{link.teacher.display_name or link.teacher.email} との紐付けを解除しました'
        })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def check_teacher_permission(request):
    """講師権限チェックAPI"""
    user = request.user
    
    # デバッグログを追加
    logger.info(f"check_teacher_permission called for user: {user}")
    logger.info(f"User email: {user.email}")
    logger.info(f"User role: {user.role}")
    logger.info(f"User is_authenticated: {user.is_authenticated}")
    
    # メールアドレスが存在することを確認
    if not user.email:
        logger.warning(f"User {user.id} has no email address")
        return Response({
            'error': 'メールアドレスが設定されていません',
            'is_teacher': False,
            'is_whitelisted': False,
            'role': user.role,
            'email': user.email,
            'permissions': {
                'can_access_admin': False,
                'can_create_invites': False,
                'can_manage_students': False,
            }
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # ホワイトリストチェックに基づいてロールを自動更新
    is_whitelisted = is_teacher_whitelisted(user.email)
    logger.info(f"Whitelist check for {user.email}: {is_whitelisted}")
    
    if is_whitelisted:
        if user.role != 'teacher':
            logger.info(f"Updating user {user.email} role to teacher (whitelisted)")
            user.role = 'teacher'
            user.save(update_fields=['role'])
    else:
        if user.role == 'teacher':
            logger.info(f"Updating user {user.email} role to student (not whitelisted)")
            user.role = 'student'
            user.save(update_fields=['role'])
    
    return Response({
        'is_teacher': user.is_teacher,
        'is_whitelisted': is_whitelisted,
        'role': user.role,
        'email': user.email,
        'permissions': {
            'can_access_admin': user.is_teacher and is_whitelisted,
            'can_create_invites': user.is_teacher and is_whitelisted,
            'can_manage_students': user.is_teacher and is_whitelisted,
        }
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def debug_auth(request):
    """認証デバッグAPI（テスト用）"""
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    user_info = {
        'is_authenticated': request.user.is_authenticated,
        'user_id': str(request.user.id) if request.user.is_authenticated else None,
        'email': request.user.email if request.user.is_authenticated else None,
        'username': request.user.username if request.user.is_authenticated else None,
        'role': getattr(request.user, 'role', None) if request.user.is_authenticated else None,
    }
    
    logger.info(f"Debug auth - Authorization header: {auth_header[:50]}...")
    logger.info(f"Debug auth - User info: {user_info}")
    
    # ホワイトリストチェック
    if request.user.is_authenticated and request.user.email:
        is_whitelisted = is_teacher_whitelisted(request.user.email)
        logger.info(f"Debug auth - Whitelist check for {request.user.email}: {is_whitelisted}")
        user_info['is_whitelisted'] = is_whitelisted
    else:
        user_info['is_whitelisted'] = False
    
    return Response({
        'message': 'Debug authentication info',
        'auth_header_present': bool(auth_header),
        'auth_header_length': len(auth_header),
        'user': user_info,
        'request_meta_keys': list(request.META.keys())[:10],  # 最初の10個のキーのみ
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def create_test_user(request):
    """テスト用ユーザー作成API（デバッグ用）"""
    email = request.data.get('email')
    name = request.data.get('name', '')
    
    if not email:
        return Response({'error': 'メールアドレスが必要です'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'username': email,
                'display_name': name,
                'role': 'student'
            }
        )
    except User.MultipleObjectsReturned:
        logger.warning(f"Multiple users returned for email={email} in create_test_user; using first match")
        user = User.objects.filter(email=email).order_by('id').first()
        created = False
    
    # ホワイトリストチェックに基づいてロール設定
    if is_teacher_whitelisted(email):
        user.role = 'teacher'
        user.save(update_fields=['role'])
    
    # APIトークン作成
    token, token_created = Token.objects.get_or_create(user=user)
    
    return Response({
        'message': f'ユーザーが{"作成" if created else "取得"}されました',
        'user': {
            'id': str(user.id),
            'email': user.email,
            'display_name': user.display_name,
            'role': user.role
        },
        'access_token': token.key,
        'is_whitelisted': is_teacher_whitelisted(email)
    })
