import os
import redis

import pytz
from flask_session import Session
JST = pytz.timezone("Asia/Tokyo")

from flask import Flask, render_template, jsonify, redirect, url_for, session, request
from flask_dance.contrib.google import make_google_blueprint, google
import json
import logging
from dateutil import parser
from dateutil.relativedelta import relativedelta
from dotenv import load_dotenv
load_dotenv()

# ロギング設定（DEBUGレベルで出力）
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
app.config['SESSION_TYPE'] = 'redis'
app.config['SESSION_REDIS'] = redis.from_url(os.environ.get("REDIS_URL"))
app.config['SESSION_PERMANENT'] = False
app.config['SESSION_USE_SIGNER'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'None'
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_DOMAIN'] = '.onrender.com'
Session(app)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'your_secret_key')  # セキュアな環境変数から取得

# Render環境でHTTPSが使えない場合に一時的にhttp許容
if os.environ.get("RENDER") == "true":
    app.config['PREFERRED_URL_SCHEME'] = 'https'
else:
    os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'  # ローカル開発時のみHTTP許容

@app.before_request
def debug_session():
    app.logger.debug("SESSION DATA: %s", dict(session))

# 環境変数からGoogle OAuthの認証情報を取得
google_client_id = os.getenv("GOOGLE_CLIENT_ID")
google_client_secret = os.getenv("GOOGLE_CLIENT_SECRET")

google_bp = make_google_blueprint(
    client_id=google_client_id,
    client_secret=google_client_secret,
    scope=[
        "openid",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile"
    ],
    redirect_to="levels",  # ログイン後にレベル選択画面へリダイレクト
    redirect_url=os.getenv("GOOGLE_REDIRECT_URL")
)
app.register_blueprint(google_bp, url_prefix="/login")


from firestore_client import db  # Firestore クライアントを利用
from google.cloud import firestore  # Firestore のタイムスタンプなどを使うため

# 英単語クイズ用データの読み込み関数
def load_quiz_data():
    data = []
    try:
        with open('data.jsonl', 'r', encoding='utf-8') as f:
            for line in f:
                data.append(json.loads(line))
    except Exception as e:
        logging.error("Quizデータの読み込みに失敗: %s", e)
    return data

quiz_data = load_quiz_data()

from firestore_client import db  # Firestore クライアントを利用
from google.cloud import firestore  # Firestore のタイムスタンプなどを使うため

# 英単語クイズ用データの読み込み関数
def load_quiz_data():
    data = []
    try:
        with open('data.jsonl', 'r', encoding='utf-8') as f:
            for line in f:
                data.append(json.loads(line))
    except Exception as e:
        logging.error("Quizデータの読み込みに失敗: %s", e)
    return data

quiz_data = load_quiz_data()

@app.route('/levels')
def levels():
    if not google.authorized:
         return redirect(url_for('google.login'))
    try:
         resp = google.get("/oauth2/v2/userinfo")
         if not resp.ok:
              return redirect(url_for('home'))
         user_info = resp.json()
    except Exception as e:
         app.logger.exception("ユーザー情報取得エラー: %s", e)
         return redirect(url_for('home'))
    
    total_questions = len(quiz_data)
    segment_size = 50
    total_levels = (total_questions + segment_size - 1) // segment_size  # 切り上げ
    levels_list = [
        {'level': i+1,
         'start': i * segment_size + 1,
         'end': min((i+1) * segment_size, total_questions)}
        for i in range(total_levels)
    ]
    return render_template('level_selection.html', levels=levels_list, user=user_info)


@app.route('/')
def home():
    user_info = None
    if google.authorized:
        try:
            resp = google.get("/oauth2/v2/userinfo")
            if resp.ok:
                user_info = resp.json()
        except Exception as e:
            app.logger.exception("Googleユーザー情報取得中にエラー発生: %s", e)
    return render_template('home.html', user=user_info)

@app.route('/quiz/<int:level>')
# This route renders index.html with context: quiz_data, user, level
def quiz_level(level):
    if not google.authorized:
         return redirect(url_for('google.login'))
    try:
         resp = google.get("/oauth2/v2/userinfo")
         if not resp.ok:
              return redirect(url_for('home'))
         user_info = resp.json()
    except Exception as e:
         app.logger.exception("ユーザー情報取得エラー: %s", e)
         return redirect(url_for('home'))
    
    segment_size = 50
    start_index = (level - 1) * segment_size
    end_index = start_index + segment_size
    level_quiz_data = quiz_data[start_index:end_index]
    return render_template('index.html', quiz_data=level_quiz_data, user=user_info, level=level)

@app.route('/segments/<int:level>')
def segments(level):
    if not google.authorized:
         return redirect(url_for('google.login'))
    try:
         resp = google.get("/oauth2/v2/userinfo")
         if not resp.ok:
              return redirect(url_for('home'))
         user_info = resp.json()
    except Exception as e:
         app.logger.exception("ユーザー情報取得エラー: %s", e)
         return redirect(url_for('home'))

    segment_size = 10
    total_segments = 5
    segments_list = []
    for i in range(total_segments):
        segments_list.append({
            'segment': i + 1,
            'start': i * segment_size + 1,
            'end': (i + 1) * segment_size
        })
    return render_template('segment_selection.html', level=level, segments=segments_list, user=user_info)

@app.route('/quiz/<int:level>/<int:segment>')
# This route renders index.html with context: quiz_data, user, level, segment, is_shuffled=False
def quiz_segment(level, segment):
    if not google.authorized:
         return redirect(url_for('google.login'))
    try:
         resp = google.get("/oauth2/v2/userinfo")
         if not resp.ok:
              return redirect(url_for('home'))
         user_info = resp.json()
    except Exception as e:
         app.logger.exception("ユーザー情報取得エラー: %s", e)
         return redirect(url_for('home'))
    
    level_segment_size = 50
    level_start = (level - 1) * level_segment_size
    level_end = level_start + level_segment_size
    level_questions = quiz_data[level_start:level_end]
    
    segment_size = 10
    seg_start = (segment - 1) * segment_size
    seg_end = seg_start + segment_size
    segment_quiz_data = level_questions[seg_start:seg_end]
    
    return render_template('index.html', quiz_data=segment_quiz_data, user=user_info, level=level, segment=segment, is_shuffled=False)


@app.route('/quiz/<int:level>/all_shuffled')
# This route renders index.html with context: quiz_data, user, level, is_shuffled=True
def quiz_all_shuffled(level):
    if not google.authorized:
         return redirect(url_for('google.login'))
    try:
         resp = google.get("/oauth2/v2/userinfo")
         if not resp.ok:
              return redirect(url_for('home'))
         user_info = resp.json()
    except Exception as e:
         app.logger.exception("ユーザー情報取得エラー: %s", e)
         return redirect(url_for('home'))
    
    level_segment_size = 50
    level_start = (level - 1) * level_segment_size
    level_end = level_start + level_segment_size
    level_questions = quiz_data[level_start:level_end]

    import random
    questions_copy = level_questions.copy()
    random.shuffle(questions_copy)
    
    return render_template('index.html', quiz_data=questions_copy, user=user_info, level=level, is_shuffled=True)


# ログアウト後はホーム画面に戻す
@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('home'))


@app.route('/submit', methods=['POST'])
def submit_score():
    data = request.get_json()
    app.logger.info("Received data: %s", data)
    try:
        user_info = None
        if google.authorized:
            resp = google.get("/oauth2/v2/userinfo")
            if resp.ok:
                user_info = resp.json()
                app.logger.debug("取得したユーザー情報: %s", user_info)
            else:
                app.logger.error("ユーザー情報取得に失敗: %s", resp.text)
        else:
            app.logger.warning("Google認証されていません")
        
        if user_info:
            user_email = user_info.get("email")
            user_ref = db.collection('users').document(user_email)
            if not user_ref.get().exists:
                user_ref.set({'email': user_email})
                app.logger.info("新規ユーザー作成: %s", user_email)
        
        quiz_result_data = {
            'user_email': user_info.get("email") if user_info else None,
            'score': data.get("score"),
            'total': data.get("total"),
            'total_time': data.get("time"),
            'timestamp': firestore.SERVER_TIMESTAMP,
            'created_at': firestore.SERVER_TIMESTAMP
        }
        quiz_result_ref = db.collection('quiz_results').add(quiz_result_data)
        write_result = quiz_result_ref[1]  # FirestoreWriteResult を受け取る（保存完了を待つ）
        quiz_result_id = quiz_result_ref[0].id
        app.logger.info("QuizResult保存完了: id=%s", quiz_result_id)
        
        for detail in data.get("results", []):
            detail_data = {
                'question': detail.get("question"),
                'user_answer': detail.get("userAnswer"),
                'correct_answer': detail.get("correctAnswer"),
                'answer_time': detail.get("time")
            }
            db.collection('quiz_results').document(quiz_result_id).collection('details').add(detail_data)
        app.logger.info("全てのQuizDetail保存完了")
    
    except Exception as e:
        app.logger.exception("Error saving quiz result: %s", e)
        return jsonify({"status": "error", "message": "データ保存に失敗しました"}), 500
    
    return jsonify({"status": "success"}), 200

@app.route('/results')
def results():
    if not google.authorized:
        return redirect(url_for("google.login"))
    resp = google.get("/oauth2/v2/userinfo")
    if not resp.ok:
        return redirect(url_for("index"))
    user_info = resp.json()
    user_email = user_info.get("email")
    
    quiz_results_query = db.collection('quiz_results').where('user_email', '==', user_email).stream()
    quiz_results = []
    for doc in quiz_results_query:
        result = doc.to_dict()
        result['id'] = doc.id

        # JSTに変換
        ts = result.get("timestamp") or result.get("created_at")
        if ts:
            try:
                if hasattr(ts, "to_datetime"):
                    dt_utc = ts.to_datetime()
                elif isinstance(ts, str):
                    dt_utc = parser.parse(ts)
                elif isinstance(ts, datetime):
                    dt_utc = ts
                else:
                    dt_utc = datetime.utcnow()
                ts_jst = dt_utc + timedelta(hours=9)
                result["timestamp_jst_str"] = ts_jst.strftime("%Y-%m-%d %H:%M")
            except Exception as e:
                app.logger.exception("timestamp JST 変換に失敗: %s", e)
                result["timestamp_jst_str"] = "不明"
        else:
            result["timestamp_jst_str"] = "不明"

        # 合計解答時間を1桁にフォーマット
        result['total_time_display'] = f"{float(result.get('total_time', 0)):.1f}"

        quiz_results.append(result)
    
    return render_template('results.html', quiz_results=quiz_results, user=user_info)


@app.route('/results/<result_id>')
def result_detail(result_id):
    result_doc = db.collection('quiz_results').document(result_id).get()
    if not result_doc.exists:
        return "結果が見つかりません", 404
    result = result_doc.to_dict()
    if 'timestamp' in result and result['timestamp'] is not None:
        try:
            result['timestamp'] = result['timestamp'].to_datetime()
        except Exception as e:
            app.logger.exception("Timestamp conversion error: %s", e)
    details_query = db.collection('quiz_results').document(result_id).collection('details').stream()
    details = [doc.to_dict() for doc in details_query]
    return render_template('result_detail.html', result=result, details=details)



from datetime import datetime, timedelta, timezone
import pytz
from oauthlib.oauth2.rfc6749.errors import TokenExpiredError
from google.cloud import firestore

# タイム補正関数（文字列が不正な場合も考慮）
def convert_to_float(val):
    try:
        return float(val)
    except (ValueError, TypeError):
        if isinstance(val, str):
            parts = val.split('.')
            if len(parts) > 1:
                cleaned = ''.join(parts[:-1]) + '.' + parts[-1]
                return float(cleaned)
        return 0.0

@app.route('/dashboard')
def dashboard():
    if not google.authorized:
        return redirect(url_for("google.login"))
    try:
        resp = google.get("/oauth2/v2/userinfo")
    except TokenExpiredError:
        session.clear()
        return redirect(url_for("google.login"))
    if not resp.ok:
        return redirect(url_for("home"))
    user_info = resp.json()
    user_email = user_info.get("email")

    quiz_results_query = db.collection('quiz_results')\
        .where('user_email', '==', user_email)\
        .order_by('created_at').get()

    JST = pytz.timezone('Asia/Tokyo')
    now_utc = datetime.now(timezone.utc)
    now_jst = now_utc.astimezone(JST)

    all_results = []

    for doc in quiz_results_query:
        data = doc.to_dict()
        result = data
        ts = result.get("created_at") or result.get("timestamp")
        if ts:
            try:
                if isinstance(ts, str):
                    dt_utc = parser.parse(ts)
                    if dt_utc.tzinfo is None:
                        dt_utc = dt_utc.replace(tzinfo=timezone.utc)
                elif hasattr(ts, 'to_datetime'):
                    dt_utc = ts.to_datetime()
                    if dt_utc.tzinfo is None:
                        dt_utc = dt_utc.replace(tzinfo=timezone.utc)
                elif isinstance(ts, datetime):
                    dt_utc = ts
                    if dt_utc.tzinfo is None:
                        dt_utc = dt_utc.replace(tzinfo=timezone.utc)
                else:
                    dt_utc = datetime.now(timezone.utc)
            except Exception as e:
                app.logger.exception("Timestamp parse error: %s", e)
                dt_utc = datetime.now(timezone.utc)
        else:
            dt_utc = datetime.now(timezone.utc)

        dt_jst = dt_utc.astimezone(JST)
        app.logger.debug(f"Parsed timestamp: raw={ts}, utc={dt_utc}, jst={dt_jst}, tzinfo={dt_utc.tzinfo}")
        result["dt_jst"] = dt_jst
        all_results.append(result)
    
    # ----------------------------
    # 1. 累計の集計
    # ----------------------------
    total_words = sum(r.get("total", 0) for r in all_results)
    total_correct = sum(r.get("score", 0) for r in all_results)
    total_time = sum(convert_to_float(r.get("total_time", 0)) for r in all_results)
    overall_accuracy = round((total_correct / total_words * 100), 2) if total_words else 0
    overall_avg_time = round((total_time / len(all_results)), 2) if all_results else 0

    # ----------------------------
    # 2. 今日の集計
    # ----------------------------
    today_start = now_jst.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow_start = today_start + timedelta(days=1)
    today_results = [r for r in all_results if today_start <= r["dt_jst"] < tomorrow_start]
    day_total_words = sum(r.get("total", 0) for r in today_results)
    day_total_correct = sum(r.get("score", 0) for r in today_results)
    day_accuracy = round((day_total_correct / day_total_words * 100), 2) if day_total_words else 0
    if today_results:
        day_total_time = sum(convert_to_float(r.get("total_time", 0)) for r in today_results)
        day_avg_time = round(day_total_time / len(today_results), 2)
    else:
        day_avg_time = 0

    # ----------------------------
    # 3. 今週の集計
    # ----------------------------
    week_start = now_jst - timedelta(days=now_jst.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    next_week_start = week_start + timedelta(days=7)
    week_results = [r for r in all_results if week_start <= r["dt_jst"] < next_week_start]
    week_total_words = sum(r.get("total", 0) for r in week_results)
    week_total_correct = sum(r.get("score", 0) for r in week_results)
    week_accuracy = round((week_total_correct / week_total_words * 100), 2) if week_total_words else 0
    if week_results:
        week_total_time = sum(convert_to_float(r.get("total_time", 0)) for r in week_results)
        week_avg_time = round(week_total_time / len(week_results), 2)
    else:
        week_avg_time = 0

    # ----------------------------
    # 4. 今月の集計
    # ----------------------------
    month_start = now_jst.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if month_start.month == 12:
        next_month_start = month_start.replace(year=month_start.year + 1, month=1)
    else:
        next_month_start = month_start.replace(month=month_start.month + 1)
    month_results = [r for r in all_results if month_start <= r["dt_jst"] < next_month_start]
    month_total_words = sum(r.get("total", 0) for r in month_results)
    month_total_correct = sum(r.get("score", 0) for r in month_results)
    month_accuracy = round((month_total_correct / month_total_words * 100), 2) if month_total_words else 0
    if month_results:
        month_total_time = sum(convert_to_float(r.get("total_time", 0)) for r in month_results)
        month_avg_time = round(month_total_time / len(month_results), 2)
    else:
        month_avg_time = 0
    
        # ----------------------------
    # 5. グラフ用データ構築
    # ----------------------------

    # (A) 日別（直近40日）
    daily_agg = {}
    daily_lookback = now_jst - timedelta(days=39)  # 今日を含めた40日分
    for i in range(40):
        day = (daily_lookback + timedelta(days=i)).strftime("%Y-%m-%d")
        daily_agg[day] = {"correct": 0, "incorrect": 0}
    for r in all_results:
        dt = r["dt_jst"]
        key = dt.strftime("%Y-%m-%d")
        if key in daily_agg:
            daily_agg[key]["correct"] += r.get("score", 0)
            daily_agg[key]["incorrect"] += r.get("total", 0) - r.get("score", 0)
    sorted_day_keys = sorted(daily_agg.keys(), key=lambda x: datetime.strptime(x, "%Y-%m-%d"))
    day_graph_labels = sorted_day_keys[-8:]
    day_graph_correct = [daily_agg[k]["correct"] for k in day_graph_labels]
    day_graph_incorrect = [daily_agg[k]["incorrect"] for k in day_graph_labels]

    # (B) 週別
    weekly_agg = {}
    base_week_start = (now_jst - timedelta(weeks=15)).replace(hour=0, minute=0, second=0, microsecond=0)
    weekly_lookback = base_week_start - timedelta(days=base_week_start.weekday())  # align to Monday
    for i in range(16):
        week = (weekly_lookback + timedelta(weeks=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        key = week.strftime("%Y-%m-%d")
        weekly_agg[key] = {"correct": 0, "incorrect": 0}
    for r in all_results:
        dt = r["dt_jst"]
        if dt >= weekly_lookback:
            week_start = dt - timedelta(days=dt.weekday())
            week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
            week_key = week_start.strftime("%Y-%m-%d")
            weekly_agg.setdefault(week_key, {"correct": 0, "incorrect": 0})
            weekly_agg[week_key]["correct"] += r.get("score", 0)
            weekly_agg[week_key]["incorrect"] += r.get("total", 0) - r.get("score", 0)
    sorted_week_starts = sorted(weekly_agg.keys())[-8:]
    week_graph_labels = [
        f"{datetime.strptime(k, '%Y-%m-%d').strftime('%-m/%-d')}〜{(datetime.strptime(k, '%Y-%m-%d') + timedelta(days=6)).strftime('%-m/%-d')}"
        for k in sorted_week_starts
    ]
    week_graph_correct = [weekly_agg[k]["correct"] for k in sorted_week_starts]
    week_graph_incorrect = [weekly_agg[k]["incorrect"] for k in sorted_week_starts]

    # (C) 月別
    monthly_agg = {}
    for i in range(6):
        month = now_jst.replace(day=1) - relativedelta(months=5 - i)
        key = month.strftime("%Y-%m")
        monthly_agg[key] = {"correct": 0, "incorrect": 0}
    monthly_lookback = now_jst - timedelta(days=180)
    for r in all_results:
        dt = r["dt_jst"]
        if dt >= monthly_lookback:
            key = dt.strftime("%Y-%m")
            monthly_agg.setdefault(key, {"correct": 0, "incorrect": 0})
            monthly_agg[key]["correct"] += r.get("score", 0)
            monthly_agg[key]["incorrect"] += r.get("total", 0) - r.get("score", 0)
    sorted_month_keys = sorted(monthly_agg.keys())
    month_graph_labels = [f"{int(k.split('-')[1])}月" for k in sorted_month_keys]
    month_graph_correct = [monthly_agg[k]["correct"] for k in sorted_month_keys]
    month_graph_incorrect = [monthly_agg[k]["incorrect"] for k in sorted_month_keys]

    return render_template(
        'dashboard.html',
        user=user_info,
        total_words=total_words,
        overall_accuracy=overall_accuracy,
        overall_avg_time=overall_avg_time,
        monthly_count=month_total_words,
        monthly_accuracy=month_accuracy,
        monthly_avg_time=month_avg_time,
        weekly_count=week_total_words,
        weekly_accuracy=week_accuracy,
        weekly_avg_time=week_avg_time,
        daily_count=day_total_words,
        daily_accuracy=day_accuracy,
        daily_avg_time=day_avg_time,
        month_graph_labels=month_graph_labels,
        month_graph_correct=month_graph_correct,
        month_graph_incorrect=month_graph_incorrect,
        week_graph_labels=week_graph_labels,
        week_graph_correct=week_graph_correct,
        week_graph_incorrect=week_graph_incorrect,
        day_graph_labels=day_graph_labels,
        day_graph_correct=day_graph_correct,
        day_graph_incorrect=day_graph_incorrect,
        total_quizzes=len(all_results)
    )

@app.route("/login/google/authorized/debug")
def google_authorized_debug():
    app.logger.debug("AUTHORIZED HIT: session keys = %s", list(session.keys()))
    if not google.authorized:
        return redirect(url_for("google.login"))
    resp = google.get("/oauth2/v2/userinfo")
    if not resp.ok:
        return redirect(url_for("home"))
    user_info = resp.json()
    return jsonify(user_info)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)