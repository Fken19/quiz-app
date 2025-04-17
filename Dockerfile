FROM python:3.10-slim

# 必要なパッケージをインストール
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Pythonパッケージのインストール
COPY requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# 認証ファイルを配置（Firestore用）
COPY english_firestore_key.json /app/english_firestore_key.json

# アプリケーションの全コードをコピー
COPY . .

# 環境変数の設定（セキュリティ上は本来.envやDocker secretsを推奨）
ENV FLASK_SECRET_KEY=dev_secret_key_for_testing
ENV GOOGLE_CLIENT_ID=REPLACE_WITH_ACTUAL_CLIENT_ID
ENV GOOGLE_CLIENT_SECRET=REPLACE_WITH_ACTUAL_CLIENT_SECRET
ENV GOOGLE_APPLICATION_CREDENTIALS=/app/english_firestore_key.json
ENV OAUTHLIB_INSECURE_TRANSPORT=1

EXPOSE 5000

CMD ["python", "app.py"]