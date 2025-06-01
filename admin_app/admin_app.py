import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
print("=== admin_app.py 起動開始 ===")

try:
    from firestore_client import get_user_doc
except Exception as e:
    print("firestore_client import 失敗:", e)
    raise
from flask import Flask, render_template, jsonify, redirect, url_for, session, request, flash, make_response
from dotenv import load_dotenv
from werkzeug.middleware.proxy_fix import ProxyFix
import logging
from google_auth_oauthlib.flow import Flow
from google.oauth2 import id_token
import google.auth.transport.requests
from datetime import datetime, timezone
from admin_auth_routes import admin_auth_bp

from admin_extensions import db

load_dotenv()

app = Flask(__name__, template_folder="templates")
app.db = db
app.register_blueprint(admin_auth_bp)
app.config['SESSION_COOKIE_NAME'] = '__session'
app.config['SESSION_PERMANENT'] = False
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'your_secret_key')
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'None'

if os.environ.get("RENDER") == "true":
    app.config['PREFERRED_URL_SCHEME'] = 'https'
else:
    os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1, x_prefix=1)

logging.basicConfig(level=logging.DEBUG)

@app.context_processor
def inject_user_profile():
    user_info = session.get("user_info", {})
    return dict(
        user_info=user_info,
        current_user_name=user_info.get("name", ""),
        current_user_picture=user_info.get("picture", ""),
        current_user_nickname=user_info.get("nickname", "")
    )

@app.before_request
def debug_session():
    app.logger.debug("SESSION DATA: %s", dict(session))

@app.before_request
def log_request_scheme():
    app.logger.debug("【確認】Request scheme: %s", request.scheme)
    app.logger.debug("【確認】Request headers: %s", dict(request.headers))

# Google OAuth2 settings
google_client_id = os.getenv("GOOGLE_CLIENT_ID")
google_client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
redirect_uri = os.getenv("GOOGLE_REDIRECT_URL")

@app.route("/login")
def login():
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": google_client_id,
                "client_secret": google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [redirect_uri]
            }
        },
        scopes=["openid", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
        redirect_uri=redirect_uri
    )
    auth_url, state = flow.authorization_url()
    session["oauth_state"] = state
    return redirect(auth_url, user_info=session.get("user_info"))

@app.route("/callback")
def callback():
    app.logger.debug("=== [CALLBACK発火] === URL: %s", request.url)
    app.logger.debug("=== CALLBACK REFERER: %s", request.headers.get("Referer"))
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": google_client_id,
                "client_secret": google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [redirect_uri]
            }
        },
        scopes=["openid", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
        state=session["oauth_state"],
        redirect_uri=redirect_uri
    )
    flow.fetch_token(authorization_response=request.url)

    credentials = flow.credentials
    idinfo = id_token.verify_oauth2_token(
        credentials.id_token,
        google.auth.transport.requests.Request(),
        google_client_id
    )

    email = idinfo["email"]
    name = idinfo.get("name", "")
    picture = idinfo.get("picture", "")

    user_doc = get_user_doc(email)
    custom_icon = user_doc.get("custom_icon_url", None)
    icon_url = custom_icon if custom_icon else picture
    nickname = user_doc.get("nickname", email)
    user_id = user_doc.get("user_id", "")

    # 先に user_info を session に格納する
    session["user_info"] = {
        "email": email,
        "name": name,
        "picture": icon_url,
        "custom_icon_url": icon_url,
        "nickname": nickname,
        "user_id": user_id
    }

    # その後に admin アカウントかどうかをチェック
    admin_doc = app.db.collection("admin_accounts").document(email).get()
    if not admin_doc.exists:
        flash("このアカウントには管理者権限がありません", "error")
        return redirect(url_for("login"))

    return redirect(url_for("select_group"))

@app.route("/logout")
def logout():
    session.clear()
    response = make_response(redirect(url_for("logged_out")))
    response.delete_cookie("__session", path="/")
    return response

@app.route("/logged-out")
def logged_out():
    return render_template("admin_logged_out.html")


@app.route("/")
def home():
    user = session.get("user_info")
    return render_template("admin_home.html", user_info=session.get("user_info"))


# グループ作成用ルート
@app.route("/create-group", methods=["GET", "POST"])
def create_group():
    user = session.get("user_info")
    if not user:
        return redirect(url_for("login"))

    if request.method == "POST":
        group_name = request.form.get("group_name", "").strip()
        if group_name:
            app.db.collection("admin_groups").add({
                "group_name": group_name,
                "created_by": user["email"],
                "students": []
            })
            flash("グループを作成しました", "success")
            return redirect(url_for("select_group"))
        else:
            flash("グループ名を入力してください", "danger")

    return render_template("admin_create_group.html", user_info=session.get("user_info"))

@app.route("/select-group")
def select_group():
    user = session.get("user_info")
    if not user:
        return redirect(url_for("login"))

    groups_ref = app.db.collection("admin_groups")
    groups = [doc.to_dict() | {"id": doc.id} for doc in groups_ref.stream() if doc.get("created_by") == user["email"]]
    return render_template("admin_group_selection.html", user_info=session.get("user_info"))

@app.route("/add-student", methods=["GET", "POST"])
def add_student():
    user = session.get("user_info")
    if not user:
        return redirect(url_for("login"))

    if request.method == "POST":
        student_email = request.form.get("student_email", "").strip()
        group_id = request.form.get("group_id", "").strip()

        if not student_email or not group_id:
            flash("必要な情報が不足しています", "danger")
            return redirect(url_for("add_student"))

        group_ref = app.db.collection("admin_groups").document(group_id)
        group_doc = group_ref.get()
        if not group_doc.exists:
            flash("指定されたグループが存在しません", "danger")
            return redirect(url_for("add_student"), user_info=session.get("user_info"))

        group_data = group_doc.to_dict()
        students = group_data.get("students", [])
        if student_email not in students:
            students.append(student_email)
            group_ref.update({"students": students})
            flash("生徒を追加しました", "success")
        else:
            flash("この生徒は既に追加されています", "info")

        return redirect(url_for("select_group"))

    return render_template("admin_add_students.html", user_info=session.get("user_info"))


if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8081))
    app.run(host='0.0.0.0', port=port, debug=True)
