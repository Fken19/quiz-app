from google.cloud import firestore

# Firestore のクライアントを初期化（環境変数 GOOGLE_APPLICATION_CREDENTIALS にサービスアカウントJSONのパスを設定しておくこと）
db = firestore.Client()
