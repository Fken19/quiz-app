import os
from flask import Flask, jsonify, redirect, url_for
from flask_session import Session
from flask_dance.contrib.google import make_google_blueprint, google
from google.cloud import firestore
from oauthlib.oauth2.rfc6749.errors import TokenExpiredError

app = Flask(__name__)
app.config["SESSION_TYPE"] = "filesystem"
Session(app)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'your_secret_key')
app.config['SESSION_COOKIE_SECURE'] = False
app.config['SESSION_COOKIE_SAMESITE'] = "Lax"

google_bp = make_google_blueprint(
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    scope=[
        "openid",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile"
    ],
    redirect_url="http://localhost:8080/login/google/authorized"
)
app.register_blueprint(google_bp, url_prefix="/login")

# Firestoreクライアント
db = firestore.Client()

@app.route("/")
def index():
    if not google.authorized:
        return redirect(url_for("google.login"))
    return redirect(url_for("debug_data"))

@app.route("/debug_data")
def debug_data():
    if not google.authorized:
        return jsonify({"error": "Not authenticated with Google"}), 401
    try:
        resp = google.get("/oauth2/v2/userinfo")
        if not resp.ok:
            return jsonify({"error": "Failed to get user info"}), 403
        user_info = resp.json()
        user_email = user_info.get("email")
    except TokenExpiredError:
        return jsonify({"error": "Token expired"}), 403

    # Firestoreからデータ取得
    query = db.collection("quiz_results").where("user_email", "==", user_email)
    docs = query.stream()

    results = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        results.append(data)

    return jsonify(results)

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=8080, debug=True)