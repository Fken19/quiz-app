import os
import json
from google.cloud import firestore
from google.oauth2 import service_account

# 環境変数からFirestore認証情報（JSON文字列）を取得し、辞書に変換
key_data = os.getenv("FIRESTORE_KEY_JSON")
info = json.loads(key_data)

# 認証情報を用いてFirestoreクライアントを初期化
credentials = service_account.Credentials.from_service_account_info(info)
db = firestore.Client(credentials=credentials, project=info["project_id"])
