from django.utils import timezone


def extract_numeric_level(session) -> int:
    """NewQuizSession から表示用の数値レベルを抽出する。
    優先: segment.level_id.level_name 内の数字 -> 無ければ segment_id or segment -> デフォルト1
    例: level_name="Level 3" -> 3
    """
    try:
        ln = ''
        seg = getattr(session, 'segment', None)
        if seg is not None:
            lvl = getattr(seg, 'level_id', None)
            if lvl is not None:
                ln = getattr(lvl, 'level_name', '') or ''
        if ln:
            import re
            m = re.search(r"(\d+)", ln)
            if m:
                return int(m.group(1))
        # fallback
        return int(getattr(session, 'segment_id', None) or getattr(session, 'segment', None) or 1)
    except Exception:
        return 1


def map_session_summary(session, *, include_totals=False, totals=None):
    """ダッシュボード/履歴向けに NewQuizSession をレガシー互換のサマリにマップする。
    include_totals=True のとき、totals={'total_questions','total_correct','total_duration_ms'} を併載。
    totals 未指定時はセッションの素の属性でフォールバック（score, question_count, total_time_ms）。
    """
    try:
        lvl = extract_numeric_level(session)
        qcount = int(getattr(session, 'question_count', 10) or 10)
        score_val = int(getattr(session, 'score', 0) or 0)
        total_ms = int(getattr(session, 'total_time_ms', 0) or 0)
        payload = {
            'id': str(session.id),
            'mode': getattr(session, 'mode', 'default'),
            'level': lvl,
            'segment': getattr(session, 'segment_id', None) or getattr(session, 'segment', None) or 1,
            'question_count': qcount,
            'created_at': (getattr(session, 'started_at') or timezone.now()).isoformat(),
            'started_at': (getattr(session, 'started_at') or timezone.now()).isoformat(),
            'finished_at': (getattr(session, 'completed_at') or getattr(session, 'started_at') or timezone.now()).isoformat(),
            'score': score_val,
            'title': f"Level {lvl} - {qcount}問",
            'total_questions': qcount,
            'total_correct': score_val,
            'total_duration_ms': total_ms,
        }
        if include_totals:
            t = totals or {}
            payload.update({
                'total_questions': int(t.get('total_questions', qcount) or 0),
                'total_correct': int(t.get('total_correct', score_val) or 0),
                'total_duration_ms': int(t.get('total_duration_ms', total_ms) or 0),
            })
        return payload
    except Exception:
        # 最低限の安全フォールバック
        return {
            'id': str(getattr(session, 'id', 'unknown')),
            'mode': 'default',
            'level': 1,
            'segment': 1,
            'question_count': 10,
            'created_at': timezone.now().isoformat(),
            'started_at': timezone.now().isoformat(),
            'finished_at': timezone.now().isoformat(),
            'score': 0,
            'title': 'Level 1 - 10問',
            'total_questions': 10,
            'total_correct': 0,
            'total_duration_ms': 0,
        }
