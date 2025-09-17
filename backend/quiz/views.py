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
    InviteCode, TeacherStudentLink, Group, GroupMembership, TeacherStudentAlias, AssignedTest, TestTemplate, TestTemplateItem
)
from .serializers import (
    UserSerializer, WordSerializer, WordTranslationSerializer,
    QuizSetSerializer, QuizItemSerializer, QuizResponseSerializer,
    QuizSetListSerializer, QuizSetCreateSerializer, DashboardStatsSerializer,
    InviteCodeSerializer, CreateInviteCodeSerializer, AcceptInviteCodeSerializer,
    TeacherStudentLinkSerializer, GroupSerializer, GroupCreateUpdateSerializer,
    GroupMembershipSerializer, TeacherStudentAliasSerializer, UpsertAliasSerializer,
    SearchStudentsSerializer, GroupMembershipAttributesUpdateSerializer, GroupRankingItemSerializer, MinimalUserSerializer,
    TestTemplateSerializer, AssignedTestSerializer
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
        try:
            reaction_time_ms = int(request.data.get('reaction_time_ms', 0))
        except (TypeError, ValueError):
            reaction_time_ms = 0
        timeout_flag = request.data.get('timeout') in (True, 'true', '1', 1)

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
            # 2) フォールバック: 選択テキスト or タイムアウト扱い
            chosen_text = (selected_answer_text or '').strip()
            if not chosen_text:
                # タイムアウト（選択なし）を許容して保存
                if timeout_flag or reaction_time_ms >= 10000:
                    chosen_text = 'Unknown'
                    is_correct = False
                    # 念のため下限を 10000ms に丸める
                    if reaction_time_ms < 10000:
                        reaction_time_ms = 10000
                else:
                    return Response({'error': '選択内容が不正です'}, status=status.HTTP_400_BAD_REQUEST)
            else:
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

    # 期間別サマリー（今日/今週/今月/全体）
    def compute_summary(qs):
        total = qs.count()
        correct = qs.filter(is_correct=True).count()
        acc = float((correct / total * 100.0) if total else 0.0)
        avg_latency = qs.filter(reaction_time_ms__gt=0).aggregate(avg=Avg('reaction_time_ms'))['avg'] or 0
        # 現状、平均スコアは平均正答率と同義（クイズ単位の平均が必要な場合はQuizSet単位集計に拡張）
        return {
            'total_questions': int(total),
            'avg_latency_ms': int(round(avg_latency or 0)),
            'avg_accuracy_pct': round(acc, 1),
            'avg_score_pct': round(acc, 1),
        }

    # 週: 直近7日、月: 月初から
    week_start = now - timezone.timedelta(days=7)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    periods = {
        'today': base_qs.filter(created_at__date=now.date()),
        'week': base_qs.filter(created_at__gte=week_start),
        'month': base_qs.filter(created_at__gte=month_start),
        'all': base_qs,
    }
    summary = {k: compute_summary(qs) for k, qs in periods.items()}

    return Response({
        'daily': daily,
        'weekly': weekly,
        'monthly': monthly,
        'streak': streak,
        'heatmap7': heatmap7,
        'summary': summary,
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
        total_duration_ms = quiz_responses.aggregate(total=Sum('reaction_time_ms'))['total'] or 0
        average_latency_ms = quiz_responses.aggregate(avg=Avg('reaction_time_ms'))['avg'] or 0

        # データ構築
        items_data = []
        responses_data = []
        # 各クイズアイテムごとに、訳文テキスト -> 翻訳ID のマップを保持（ID復元用）
        text_id_map_by_item = {}

        for item in quiz_items:
            translations = WordTranslation.objects.filter(word=item.word)
            try:
                primary = next((t for t in translations if getattr(t, 'is_correct', False)), None)
            except Exception:
                primary = None

            items_data.append({
                'id': str(item.id),
                'quiz_set_id': str(quiz_set.id),
                'word_id': str(item.word.id),
                'word': {
                    'id': str(item.word.id),
                    'text': item.word.text,
                    'pos': getattr(item.word, 'pos', 'unknown'),
                    'level': item.word.grade,
                    'tags': [],
                    'description': (getattr(primary, 'context', '') or None)
                },
                'translations': [
                    {
                        'id': str(t.id),
                        'word_id': str(t.word_id),
                        'ja': t.text,
                        'is_correct': bool(getattr(t, 'is_correct', False)),
                        'context': getattr(t, 'context', '')
                    } for t in translations
                ],
                'order_no': item.order
            })
            try:
                text_id_map_by_item[int(item.id)] = {(t.text or ''): int(t.id) for t in translations}
            except Exception:
                text_id_map_by_item[int(item.id)] = {}

        for response in quiz_responses:
            # 回答テキストから翻訳IDを復元（可能な場合）
            chosen_id = None
            try:
                m = text_id_map_by_item.get(int(response.quiz_item.id), {})
                cid = m.get(response.selected_answer or '')
                if cid is not None:
                    chosen_id = str(cid)
            except Exception:
                chosen_id = None

            responses_data.append({
                'id': str(response.id),
                'quiz_item_id': str(response.quiz_item.id),
                'user_id': str(response.user.id) if getattr(response, 'user', None) else None,
                'chosen_translation_id': chosen_id,
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

    @action(detail=True, methods=['get'])
    def detail(self, request, pk=None):
        """講師視点の生徒詳細（エイリアス・所属グループ・基本統計）"""
        link = self.get_object()
        student = link.student
        # 所属グループ（この講師がownerのもの限定）
        groups = Group.objects.filter(owner_admin=request.user, memberships__user=student).order_by('name')
        # エイリアス
        alias = TeacherStudentAlias.objects.filter(teacher=request.user, student=student).first()
        # 統計
        total = QuizResponse.objects.filter(user=student).count()
        correct = QuizResponse.objects.filter(user=student, is_correct=True).count()
        acc = (correct / total * 100) if total > 0 else 0
        return Response({
            'student': UserSerializer(student, context={'request': request}).data,
            'alias': TeacherStudentAliasSerializer(alias, context={'request': request}).data if alias else None,
            'groups': GroupSerializer(groups, many=True, context={'request': request}).data,
            'stats': {
                'total_answers': total,
                'correct_answers': correct,
                'accuracy_pct': round(acc, 2),
            }
        })


class TeacherGroupViewSet(viewsets.ModelViewSet):
    """講師用グループ管理API
    - list/create/update/delete: 自分のグループのみ
    - members: メンバー一覧
    - add_members: 生徒検索 + 一括追加
    - remove_member: メンバー削除
    """
    permission_classes = [IsTeacherPermission]

    def get_queryset(self):
        return Group.objects.filter(owner_admin=self.request.user).order_by('-created_at')

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return GroupCreateUpdateSerializer
        return GroupSerializer

    def perform_create(self, serializer):
        serializer.save(owner_admin=self.request.user)

    def create(self, request, *args, **kwargs):
        """作成時はフルのGroupSerializerで返す（id/owner_admin/created_at含む）"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        group = serializer.save(owner_admin=request.user)
        # 返却は詳細用
        out = GroupSerializer(group, context=self.get_serializer_context())
        headers = self.get_success_headers(out.data)
        return Response(out.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        """更新時もフルのGroupSerializerで返す"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        group = serializer.save()
        out = GroupSerializer(group, context=self.get_serializer_context())
        return Response(out.data)

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)

    @action(detail=True, methods=['get'])
    def members(self, request, pk=None):
        group = self.get_object()
        qs = GroupMembership.objects.filter(group=group).select_related('user')
        # filters
        attr1 = request.query_params.get('attr1')
        attr2 = request.query_params.get('attr2')
        q = request.query_params.get('q')
        if attr1:
            qs = qs.filter(attr1__icontains=attr1)
        if attr2:
            qs = qs.filter(attr2__icontains=attr2)
        if q:
            # display_name or username; alias name support via subquery list
            alias_ids = list(
                TeacherStudentAlias.objects.filter(teacher=request.user, alias_name__icontains=q)
                .values_list('student_id', flat=True)
            )
            qs = qs.filter(Q(user__display_name__icontains=q) | Q(user__username__icontains=q) | Q(user_id__in=alias_ids))

        # ordering
        order = request.query_params.get('order', 'created_at')  # 'created_at' | 'name'
        if order == 'name':
            # Python-side sort by effective_name for simplicity
            memberships = list(qs)
            def eff_name(m):
                alias = TeacherStudentAlias.objects.filter(teacher=request.user, student=m.user).first()
                return (alias.alias_name if alias else None) or (m.user.display_name or '')
            memberships.sort(key=eff_name)
        else:
            memberships = list(qs.order_by('created_at'))

        data = GroupMembershipSerializer(memberships, many=True, context={'request': request}).data
        return Response({'members': data, 'count': len(data)})

    @action(detail=True, methods=['post'], url_path=r'members/(?P<member_id>[^/.]+)/attributes')
    def update_member_attributes(self, request, pk=None, member_id=None):
        """グループ内の管理用属性（attr1, attr2）を更新"""
        group = self.get_object()
        membership = get_object_or_404(GroupMembership, group=group, id=member_id)
        ser = GroupMembershipAttributesUpdateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        changed = False
        for field in ['attr1', 'attr2']:
            if field in ser.validated_data:
                setattr(membership, field, ser.validated_data[field])
                changed = True
        if changed:
            membership.save(update_fields=['attr1', 'attr2'])
        return Response(GroupMembershipSerializer(membership, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def add_members(self, request, pk=None):
        """生徒検索（絞り込み/フリーワード）+ 一括追加
        body: { q?: string, status?: 'active'|'pending'|'all', student_ids?: UUID[] }
        - student_ids があればそれを優先して追加
        - なければ q/status に基づいて候補を返し、confirm フラグで追加（2段階）
        """
        group = self.get_object()
        body = request.data or {}

        # 明示ID指定での一括追加
        explicit_ids = body.get('student_ids') or []
        created = 0
        skipped = 0
        created_items = []
        if explicit_ids:
            students = list(User.objects.filter(id__in=explicit_ids))
            existing = set(
                GroupMembership.objects.filter(group=group, user__in=students).values_list('user_id', flat=True)
            )
            for stu in students:
                if stu.id in existing:
                    skipped += 1
                    continue
                gm = GroupMembership.objects.create(group=group, user=stu, role='student')
                created += 1
                created_items.append(gm)
            return Response({
                'created': created,
                'skipped': skipped,
                'members': GroupMembershipSerializer(created_items, many=True, context={'request': request}).data
            })

        # 検索用パラメータのバリデーション
        ser = SearchStudentsSerializer(data=body)
        ser.is_valid(raise_exception=True)
        q = ser.validated_data.get('q')
        status_filter = ser.validated_data.get('status')

        # まず講師と紐付いた生徒から検索（pending/active）
        links = TeacherStudentLink.objects.filter(teacher=request.user)
        if status_filter == 'active':
            links = links.filter(status='active')
        elif status_filter == 'pending':
            links = links.filter(status='pending')
        else:
            links = links.exclude(status='revoked')

        student_qs = User.objects.filter(id__in=links.values('student_id'))
        if q:
            q_icontains = Q(email__icontains=q) | Q(display_name__icontains=q) | Q(username__icontains=q)
            student_qs = student_qs.filter(q_icontains)

        student_qs = student_qs.order_by('display_name', 'email')[:100]

        # 既にグループにいる生徒を除いた候補
        existing_ids = set(GroupMembership.objects.filter(group=group).values_list('user_id', flat=True))
        candidates = [s for s in student_qs if s.id not in existing_ids]

        return Response({
            'candidates': MinimalUserSerializer(candidates, many=True, context={'request': request}).data,
            'count': len(candidates)
        })

    @action(detail=True, methods=['delete'], url_path='remove-member/(?P<member_id>[^/.]+)')
    def remove_member(self, request, pk=None, member_id=None):
        group = self.get_object()
        membership = get_object_or_404(GroupMembership, group=group, id=member_id)
        membership.delete()
        return Response({'message': 'メンバーを削除しました'})

    # CSVエクスポート機能は要望により削除しました

    @action(detail=True, methods=['get'], url_path='rankings')
    def rankings(self, request, pk=None):
        """グループ内ランキング（日/週/月・正答率や回答数など切り替え）
        クエリ: ?period=daily|weekly|monthly&metric=answers|accuracy
        """
        group = self.get_object()
        period = request.query_params.get('period', 'weekly')
        metric = request.query_params.get('metric', 'answers')
        if period not in ('daily', 'weekly', 'monthly'):
            period = 'weekly'
        if metric not in ('answers', 'accuracy'):
            metric = 'answers'

        # 期間開始
        now = timezone.now()
        if period == 'daily':
            start = now - timedelta(days=1)
        elif period == 'weekly':
            start = now - timedelta(days=7)
        else:
            start = now - timedelta(days=30)

        user_ids = list(GroupMembership.objects.filter(group=group).values_list('user_id', flat=True))
        base_qs = QuizResponse.objects.filter(user_id__in=user_ids, created_at__gte=start)

        # 集計
        rows = []
        if metric == 'answers':
            counts = base_qs.values('user_id').annotate(value=Count('id')).order_by('-value')
            lookup = {c['user_id']: c['value'] for c in counts}
            for uid in user_ids:
                rows.append({'user_id': uid, 'value': float(lookup.get(uid, 0))})
        else:  # accuracy
            totals = base_qs.values('user_id').annotate(total=Count('id'))
            corrects = base_qs.filter(is_correct=True).values('user_id').annotate(corr=Count('id'))
            total_map = {t['user_id']: t['total'] for t in totals}
            corr_map = {c['user_id']: c['corr'] for c in corrects}
            for uid in user_ids:
                t = total_map.get(uid, 0)
                c = corr_map.get(uid, 0)
                rows.append({'user_id': uid, 'value': float((c / t * 100) if t else 0.0)})

        # ユーザー最小情報を付与
        users = {u.id: u for u in User.objects.filter(id__in=[r['user_id'] for r in rows])}
        out = []
        for r in sorted(rows, key=lambda x: x['value'], reverse=True):
            u = users.get(r['user_id'])
            if not u:
                continue
            out.append({
                'user': MinimalUserSerializer(u, context={'request': request}).data,
                'value': r['value'],
                'period': period,
                'metric': metric,
            })
        return Response({'rankings': out, 'count': len(out)})

    @action(detail=True, methods=['get'], url_path='dashboard')
    def dashboard(self, request, pk=None):
        """グループダッシュボード（集計/分布/上位者）
        クエリ:
          - days: 何日分を見るか（デフォルト30）
          - min_answers_for_accuracy: 上位正答率ランキングに必要な最小回答数（デフォルト20）
        """
        group = self.get_object()
        days = int(request.query_params.get('days', 30) or 30)
        min_ans = int(request.query_params.get('min_answers_for_accuracy', 20) or 20)
        now = timezone.now()
        start = now - timedelta(days=days)

        user_ids = list(GroupMembership.objects.filter(group=group).values_list('user_id', flat=True))
        base_qs = QuizResponse.objects.filter(user_id__in=user_ids, created_at__gte=start)

        # 総計
        total = base_qs.count()
        correct = base_qs.filter(is_correct=True).count()
        acc_pct = float((correct / total * 100) if total else 0.0)

        # 日別
        daily_rows = (
            base_qs.annotate(d=TruncDate('created_at'))
                   .values('d')
                   .annotate(total=Count('id'), correct=Count('id', filter=Q(is_correct=True)))
                   .order_by('d')
        )
        daily = [{'date': r['d'].isoformat(), 'total': r['total'], 'correct': r['correct']} for r in daily_rows]

        # 生徒別 集計
        per_user_totals = (
            base_qs.values('user_id')
                  .annotate(total=Count('id'), correct=Count('id', filter=Q(is_correct=True)))
        )
        # 分布（回答数）
        def bucket_answers(n):
            edges = [0, 10, 30, 50, 100, 200, 500, 1000]
            labels = ['0-9', '10-29', '30-49', '50-99', '100-199', '200-499', '500-999', '1000+']
            for i, e in enumerate(edges):
                if i == len(edges) - 1:
                    return labels[i]
                nxt = edges[i+1]
                if n < nxt:
                    return labels[i]
            return labels[-1]

        answers_hist = {}
        acc_hist = { '0-49': 0, '50-69': 0, '70-84': 0, '85-94': 0, '95-100': 0 }
        top_learners_rows = []
        top_accuracy_rows = []

        uid_to_stats = {}
        for r in per_user_totals:
            uid = r['user_id']
            t = int(r['total'] or 0)
            c = int(r['correct'] or 0)
            uid_to_stats[uid] = {'total': t, 'correct': c}
            # answers hist
            label = bucket_answers(t)
            answers_hist[label] = answers_hist.get(label, 0) + 1
            # accuracy hist
            a = (c / t * 100) if t else 0.0
            if a < 50:
                acc_hist['0-49'] += 1
            elif a < 70:
                acc_hist['50-69'] += 1
            elif a < 85:
                acc_hist['70-84'] += 1
            elif a < 95:
                acc_hist['85-94'] += 1
            else:
                acc_hist['95-100'] += 1

        # 上位者
        for uid, st in uid_to_stats.items():
            top_learners_rows.append({'user_id': uid, 'value': float(st['total'])})
            if st['total'] >= min_ans:
                a = float(st['correct'] / st['total'] * 100.0) if st['total'] else 0.0
                top_accuracy_rows.append({'user_id': uid, 'value': a, 'total_answers': st['total']})

        users = {u.id: u for u in User.objects.filter(id__in=list(uid_to_stats.keys()))}
        def attach_users(rows):
            out = []
            for r in rows:
                u = users.get(r['user_id'])
                if not u:
                    continue
                ent = {
                    'user': MinimalUserSerializer(u, context={'request': request}).data,
                    'value': r['value']
                }
                if 'total_answers' in r:
                    ent['total_answers'] = r['total_answers']
                out.append(ent)
            return out

        top_learners = attach_users(sorted(top_learners_rows, key=lambda x: x['value'], reverse=True)[:5])
        top_accuracy = attach_users(sorted(top_accuracy_rows, key=lambda x: x['value'], reverse=True)[:5])

        # 属性の内訳（attr1/attr2）
        mem_qs = GroupMembership.objects.filter(group=group)
        attr1_counts = (
            mem_qs.values('attr1').annotate(count=Count('id')).order_by('-count')
        )
        attr2_counts = (
            mem_qs.values('attr2').annotate(count=Count('id')).order_by('-count')
        )

        def hist_to_list(dct, order_labels=None):
            if order_labels:
                return [{'bin': k, 'count': int(dct.get(k, 0))} for k in order_labels]
            return [{'bin': k, 'count': int(v)} for k, v in dct.items()]

        return Response({
            'members_count': len(user_ids),
            'totals': {
                'total_answers': total,
                'correct_answers': correct,
                'accuracy_pct': round(acc_pct, 2),
                'period_days': days,
            },
            'daily': daily,
            'distributions': {
                'answers_per_student': hist_to_list(answers_hist, ['0-9','10-29','30-49','50-99','100-199','200-499','500-999','1000+']),
                'accuracy_per_student': hist_to_list(acc_hist, ['0-49','50-69','70-84','85-94','95-100']),
            },
            'top_learners': top_learners,
            'top_accuracy': top_accuracy,
            'attr1_breakdown': [{'value': (r['attr1'] or ''), 'count': r['count']} for r in attr1_counts],
            'attr2_breakdown': [{'value': (r['attr2'] or ''), 'count': r['count']} for r in attr2_counts],
        })

    @action(detail=True, methods=['post'])
    def assign_test(self, request, pk=None):
        """グループにテスト（AssignedTest）を配信"""
        group = self.get_object()
        body = request.data or {}
        title = body.get('title') or f"Assignment - {timezone.now().strftime('%Y-%m-%d %H:%M')}"
        due_at_raw = (request.data or {}).get('due_at')
        due_at = None
        if due_at_raw:
            try:
                due_at = timezone.datetime.fromisoformat(due_at_raw)
                if timezone.is_naive(due_at):
                    due_at = timezone.make_aware(due_at, timezone.get_current_timezone())
            except Exception:
                pass
        template_id = body.get('template_id') or body.get('template')
        timer_seconds = body.get('timer_seconds')
        template_obj = None
        if template_id:
            try:
                template_obj = TestTemplate.objects.get(id=template_id, owner=request.user)
            except TestTemplate.DoesNotExist:
                return Response({'error': 'テンプレートが見つかりません'}, status=status.HTTP_400_BAD_REQUEST)
        test = AssignedTest.objects.create(group=group, title=title, due_at=due_at, template=template_obj, timer_seconds=timer_seconds)
        return Response({'message': 'テストを配信しました', 'test': AssignedTestSerializer(test, context={'request': request}).data}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def tests(self, request, pk=None):
        group = self.get_object()
        tests = group.assigned_tests.order_by('-created_at')
        out = [
            {
                'id': str(t.id), 'title': t.title,
                'due_at': t.due_at.isoformat() if t.due_at else None,
                'created_at': t.created_at.isoformat(),
            } for t in tests
        ]
        return Response({'tests': out, 'count': len(out)})


class TeacherAliasViewSet(viewsets.GenericViewSet):
    """講師用 生徒エイリアス設定API"""
    permission_classes = [IsTeacherPermission]

    def list(self, request):
        aliases = TeacherStudentAlias.objects.filter(teacher=request.user).select_related('student').order_by('created_at')
        return Response(TeacherStudentAliasSerializer(aliases, many=True, context={'request': request}).data)

    @action(detail=False, methods=['post'])
    def upsert(self, request):
        ser = UpsertAliasSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        student_id = ser.validated_data['student_id']
        alias_name = ser.validated_data['alias_name']
        note = ser.validated_data.get('note', '')

        # 教師と生徒の関係チェック（active/pending可）
        link = TeacherStudentLink.objects.filter(teacher=request.user, student_id=student_id).exclude(status='revoked').first()
        if not link:
            return Response({'error': 'この生徒はあなたの管理対象ではありません'}, status=status.HTTP_400_BAD_REQUEST)

        alias, created = TeacherStudentAlias.objects.update_or_create(
            teacher=request.user,
            student_id=student_id,
            defaults={'alias_name': alias_name, 'note': note}
        )
        return Response({
            'created': created,
            'alias': TeacherStudentAliasSerializer(alias, context={'request': request}).data
        })

    @action(detail=False, methods=['delete'], url_path=r'(?P<student_id>[^/.]+)')
    def delete(self, request, student_id=None):
        obj = TeacherStudentAlias.objects.filter(teacher=request.user, student_id=student_id).first()
        if not obj:
            return Response({'message': 'エイリアスは存在しません'}, status=status.HTTP_404_NOT_FOUND)
        obj.delete()
        return Response({'message': 'エイリアスを削除しました'})


class TeacherTestTemplateViewSet(viewsets.ModelViewSet):
    """講師用 テストテンプレート CRUD"""
    serializer_class = TestTemplateSerializer
    permission_classes = [IsTeacherPermission]

    def get_queryset(self):
        return TestTemplate.objects.filter(owner=self.request.user).order_by('-updated_at')

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


# 追加: 学生詳細（student_id指定）
class TeacherStudentDetailViewSet(viewsets.GenericViewSet):
    permission_classes = [IsTeacherPermission]

    @action(detail=False, methods=['get'], url_path=r'by-student/(?P<student_id>[^/.]+)/detail')
    def by_student_detail(self, request, student_id=None):
        """講師視点の生徒詳細（student_id基準）"""
        # 紐付け確認
        link = TeacherStudentLink.objects.filter(teacher=request.user, student_id=student_id).exclude(status='revoked').first()
        if not link:
            return Response({'error': 'この生徒はあなたの管理対象ではありません'}, status=status.HTTP_403_FORBIDDEN)
        student = link.student
        groups = Group.objects.filter(owner_admin=request.user, memberships__user=student).order_by('name')
        alias = TeacherStudentAlias.objects.filter(teacher=request.user, student=student).first()

        # 直近30日の統計
        now = timezone.now()
        start = now - timedelta(days=30)
        qs = QuizResponse.objects.filter(user=student, created_at__gte=start)
        total = qs.count()
        correct = qs.filter(is_correct=True).count()
        acc = float((correct / total * 100) if total else 0.0)
        # 日別
        daily_rows = (
            qs.annotate(d=TruncDate('created_at')).values('d')
              .annotate(total=Count('id'), correct=Count('id', filter=Q(is_correct=True)))
              .order_by('d')
        )
        daily = [{'date': r['d'].isoformat(), 'total': r['total'], 'correct': r['correct']} for r in daily_rows]

        return Response({
            'student': MinimalUserSerializer(student, context={'request': request}).data,
            'alias': TeacherStudentAliasSerializer(alias, context={'request': request}).data if alias else None,
            'groups': GroupSerializer(groups, many=True, context={'request': request}).data,
            'stats_30d': {
                'total_answers': total,
                'correct_answers': correct,
                'accuracy_pct': round(acc, 2)
            },
            'daily': daily,
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
