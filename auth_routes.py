# auth_routes.py
from flask import Blueprint, session, redirect, request, url_for
from google_auth_oauthlib.flow import Flow
import google.auth.transport.requests
from google.oauth2 import id_token
import os

auth_bp = Blueprint('auth', __name__)

GOOGLE_CLIENT_ID = os.environ["GOOGLE_CLIENT_ID"]
REDIRECT_URI = os.environ["GOOGLE_REDIRECT_URL"]

@auth_bp.route("/login")
def login():
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [REDIRECT_URI]
            }
        },
        scopes=["openid", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
        redirect_uri=REDIRECT_URI
    )
    auth_url, state = flow.authorization_url()
    session["oauth_state"] = state
    return redirect(auth_url)

@auth_bp.route("/callback")
def callback():
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [REDIRECT_URI]
            }
        },
        scopes=["openid", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
        state=session["oauth_state"],
        redirect_uri=REDIRECT_URI
    )
    flow.fetch_token(authorization_response=request.url)
    credentials = flow.credentials

    id_info = id_token.verify_oauth2_token(
        credentials.id_token,
        google.auth.transport.requests.Request(),
        GOOGLE_CLIENT_ID
    )
    session["user_email"] = id_info["email"]
    session["user_name"] = id_info.get("name", "")
    session["user_picture"] = id_info.get("picture", "")

    from firestore_client import get_user_doc, create_user_doc
    import random
    import string

    user_email = session["user_email"]
    user_name = session["user_name"]
    user_picture = session["user_picture"]

    user_doc = get_user_doc(user_email)

    if not user_doc:
        # 初回ログインなら、nickname, user_id, custom_icon_url をセット
        user_data = {
            "email": user_email,
            "name": user_name,
            "picture": user_picture,
            "nickname": None,  # プロフィール編集画面で設定させる
            "user_id": ''.join(random.choices(string.ascii_letters + string.digits, k=8)),
            "custom_icon_url": None
        }
        create_user_doc(user_email, user_data)
        
    return redirect(url_for("home"))