import os
from google.cloud import firestore

# Cloud Run では、事前に環境変数 GOOGLE_APPLICATION_CREDENTIALS で指定した json ファイルを読み込みます
# 例: /app/english_firestore_key.json が COPY 済みであることが前提

db = firestore.Client()


def create_user_doc(email, user_data):
    users_ref = db.collection('users')
    users_ref.document(email).set(user_data)

def get_user_doc(email):
    users_ref = db.collection('users')
    return users_ref.document(email).get().to_dict()

def update_user_doc(email, update_data):
    users_ref = db.collection('users')
    users_ref.document(email).update(update_data)