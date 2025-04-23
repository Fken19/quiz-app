import os
from google.cloud import firestore

# Cloud Run では、事前に環境変数 GOOGLE_APPLICATION_CREDENTIALS で指定した json ファイルを読み込みます
# 例: /app/english_firestore_key.json が COPY 済みであることが前提

db = firestore.Client()
