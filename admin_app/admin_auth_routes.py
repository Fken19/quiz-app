# auth_routes.py
from flask import Blueprint, session, redirect, request, url_for
from google_auth_oauthlib.flow import Flow
import google.auth.transport.requests
from google.oauth2 import id_token
import os

admin_auth_bp = Blueprint('admin_auth', __name__)

GOOGLE_CLIENT_ID = os.environ["GOOGLE_CLIENT_ID"]
REDIRECT_URI = os.environ["GOOGLE_REDIRECT_URL"]

@admin_auth_bp.route("/login")
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

@admin_auth_bp.route("/callback")
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
    from firestore_client import get_user_doc, create_user_doc
    import random
    import string

    user_email = id_info["email"]
    user_name = id_info.get("name", "")
    user_picture = id_info.get("picture", "")

    user_doc = get_user_doc(user_email)

    if not user_doc:
        # 初回ログインなら、nickname, user_id, custom_icon_url をセット
        user_data = {
            "email": user_email,
            "name": user_name,
            "picture": user_picture,
            "nickname": None,
            "user_id": ''.join(random.choices(string.ascii_letters + string.digits, k=8)),
            "custom_icon_url": None
        }
        create_user_doc(user_email, user_data)
    else:
        user_data = user_doc

    session["user_info"] = {
        "user_email": user_email,
        "user_name": user_name,
        "user_picture": user_picture,
        "nickname": user_data.get("nickname") or user_name,
        "user_id": user_data.get("user_id"),
        "custom_icon_url": user_data.get("custom_icon_url") or user_picture
    }
    return redirect(url_for("select_group"))