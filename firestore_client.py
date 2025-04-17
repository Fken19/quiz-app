import os
import json
import base64
from google.cloud import firestore
from google.oauth2 import service_account

# 環境変数からBase64エンコードされたFirestore認証情報を取得し、デコード
key_base64 = os.getenv("FIRESTORE_KEY_JSON_BASE64")
key_data = base64.b64decode(key_base64).decode("utf-8")
info = json.loads(key_data)

# 認証情報を用いてFirestoreクライアントを初期化
credentials = service_account.Credentials.from_service_account_info(info)
db = firestore.Client(credentials=credentials, project=info["project_id"])
