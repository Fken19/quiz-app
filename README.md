

# 英単語クイズアプリ

![Tests](https://github.com/Fken19/quiz-app/actions/workflows/test.yml/badge.svg)

---

## 🚀 プロジェクト概要

このプロジェクトは、**Django REST Framework + Next.js + PostgreSQL + Google認証** を用いた英単語クイズアプリです。生徒がGoogleアカウントでログインし、クイズ結果を記録・可視化できます。塾や教育現場での利用を想定し、管理者（教師）機能も含みます。

---

## 🏗️ 技術スタック

- **バックエンド**: Django REST Framework + PostgreSQL
- **フロントエンド**: Next.js 15 (App Router, TypeScript, TanStack Query, Tailwind CSS)
- **認証**: Google OAuth2（NextAuth.js + Django連携）
- **インフラ**: Docker Compose（開発用）

---

## 📁 ディレクトリ構成

```
quiz-app/
├── backend/                    # Django REST API
│   ├── quiz_backend/          # Django設定
│   ├── quiz/                  # メインアプリ
│   ├── manage.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                  # Next.jsフロントエンド
│   ├── src/
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml         # 開発用コンテナ定義
├── Makefile                   # 開発補助コマンド
└── README.md
```

---

## 🐳 開発環境セットアップ（Docker推奨）

### 1. 必要なツール
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Node.js 18+](https://nodejs.org/)（フロント単体開発時のみ）

### 2. リポジトリのクローン
```sh
git clone <このリポジトリのURL>
cd quiz-app
```

### 3. 環境変数ファイルの準備
- `backend/.env` および `frontend/.env.local` を編集
	- Google認証やDB接続情報を正しく設定
	- サンプル:
		- `frontend/.env.local`
			```env
			NEXT_PUBLIC_API_URL=http://localhost:8080
			NEXT_PUBLIC_API_URL_BROWSER=http://localhost:8080
			NEXTAUTH_URL=http://localhost:3000
			GOOGLE_CLIENT_ID=xxx
			GOOGLE_CLIENT_SECRET=xxx
			```
		- `backend/.env`
			```env
			DJANGO_SECRET_KEY=xxx
			DJANGO_ALLOWED_HOSTS=*
			POSTGRES_DB=quiz_db
			POSTGRES_USER=postgres
			POSTGRES_PASSWORD=postgres
			GOOGLE_CLIENT_ID=xxx
			GOOGLE_CLIENT_SECRET=xxx
			```

### 4. Dockerコンテナのビルド＆起動
```sh
make dev    # または docker-compose up -d
```

### 5. マイグレーション・管理ユーザー作成
```sh
docker-compose exec backend python manage.py migrate
docker-compose exec backend python manage.py createsuperuser
```

### 6. 動作確認
- **フロントエンド**: http://localhost:3000
- **バックエンド API**: http://localhost:8080
- **管理画面**: http://localhost:8080/admin/

---

## 🔑 Google認証の流れ

1. ユーザーがNext.jsフロントでGoogleログイン
2. NextAuth.jsがGoogle OAuthで認証し、Django APIにIDトークンを送信
3. Django側でIDトークンを検証し、独自アクセストークンを発行
4. フロントエンドは以降、Django APIにアクセストークン付きでリクエスト

---

## 🌐 主なAPIエンドポイント

---

## 🧑‍💻 開発・ビルド・テスト

### 開発サーバー起動
```sh
make dev
# または
docker-compose up -d
```

### フロントエンド単体開発
```sh
cd frontend
npm install
npm run dev
# http://localhost:3000 で確認
```

### バックエンド単体開発
```sh
cd backend
pip install -r requirements.txt
python manage.py runserver
# http://localhost:8080 で確認
```

### ビルド（本番用）
```sh
make build
# または
docker-compose build
```

### テスト
```sh
docker-compose exec backend python manage.py test
```

---

## ⚠️ よくあるトラブル・FAQ

- **APIが401/403になる**
	- Google認証が正しく完了しているか、Django側でIDトークン検証が通っているか確認
	- `.env`のAPI URLやGoogle認証情報が正しいか再確認
- **ポート競合エラー**
	- 既にサーバーが起動している場合は`docker-compose down`で一度全て停止
- **DBに接続できない**
	- `.env`のDB設定、`docker-compose.yml`の`db`サービス設定を確認
- **フロントエンドの型エラーでビルド失敗**
	- `any`型を使わず型安全に修正。`npm run build`でエラー内容を確認

---

## 🤝 コントリビューション

1. `migrate/django` ブランチで開発
2. 機能追加・修正はプルリクエスト
3. テスト通過を確認してマージ

---

## � サポート

質問や問題がある場合は、GitHubのIssueを作成してください。

---

## 🏗️ アーキテクチャ

- **バックエンド**: Django REST Framework + Supabase(PostgreSQL)
- **フロントエンド**: Next.js（静的書き出し + Cloud Storage + CDN）
- **認証**: Google OAuth（django-allauth）
- **デプロイ**: Cloud Run（API） + Cloud Storage/CDN（フロント）
- **監視**: Cloud Logging / Error Reporting

---

## 📁 ディレクトリ構成

```
quiz-app/
├── backend/                    # Django REST API
│   ├── quiz_backend/          # Django設定
│   ├── quiz/                  # メインアプリ
│   ├── manage.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                  # Next.jsフロントエンド
├── .github/workflows/         # CI/CD
└── README.md
```

---

## 🗄️ データベース設計（主要テーブル）

---

## 🐳 開発環境セットアップ（Docker推奨）

### 1. 必要なツール
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### 2. リポジトリのクローン
```sh
git clone <このリポジトリのURL>
cd quiz-app
```

### 3. 環境変数ファイルの準備
- `backend/.env` および `frontend/.env.local` を編集（Google認証やDB接続情報を正しく設定）

### 4. Dockerコンテナのビルド＆起動（開発環境）
```sh
docker-compose up -d
```

### 5. マイグレーション・管理ユーザー作成
```sh
docker-compose exec backend python manage.py migrate
docker-compose exec backend python manage.py createsuperuser
```

### 6. 動作確認
- バックエンドAPI:  
	`curl http://localhost:8080/health/`
- フロントエンド:  
	`http://localhost:3000` にアクセス

### 7. その他よく使うコマンド
- バックエンドのシェルに入る
	```sh
	docker-compose exec backend bash
	```
- フロントエンドのシェルに入る
	```sh
	docker-compose exec frontend sh
	```
- サーバーログ確認
	```sh
	docker-compose logs -f
	```
- コンテナ停止
	```sh
	docker-compose down
	```

> ⚠️ ローカルで直接 `python` や `npm` コマンドを実行せず、**必ずコンテナ内で作業**してください。

---

## 🌐 API エンドポイント

### 認証
- `GET /api/auth/me/` - 現在のユーザー情報
- `POST /accounts/google/login/callback/` - Google OAuth コールバック

### 学習者向け
- `GET /api/questions/?level={level}&segment={segment}&limit={limit}` - 問題取得
- `POST /api/sessions/` - クイズセッション開始
- `POST /api/sessions/{id}/answers/` - 回答送信
- `POST /api/sessions/{id}/complete/` - セッション完了
- `GET /api/me/results/?from={date}&to={date}` - 結果履歴

### 管理者向け（is_staff必須）
- `GET /api/admin/users/` - ユーザー一覧
- `GET /api/admin/groups/` - グループ一覧
- `GET /api/admin/stats/daily/?scope={user|group}&from={date}&to={date}` - 日次統計

---

## 🚢 デプロイ

### Cloud Run（API）
```sh
gcloud builds submit --tag gcr.io/{PROJECT_ID}/quiz-api
gcloud run deploy quiz-api --image gcr.io/{PROJECT_ID}/quiz-api --platform managed
```

### Next.js（フロント）
```sh
npm run build
npm run export
gcloud storage rsync out/ gs://your-frontend-bucket --recursive
```

---

## 🧪 テスト

```sh
python manage.py test
```

---

## 📋 移行ステータス

| 項目 | 状況 | 備考 |
|------|------|------|
| Django設定・モデル | ✅ 完了 | PostgreSQL対応、認証設定済み |
| DRF API実装 | ✅ 完了 | CRUD、認証、管理者API |
| Firestore→PostgreSQL移行 | ⏳ 準備中 | ETLスクリプト作成予定 |
| Next.jsフロント | ⏳ 未着手 | 静的書き出し前提で開発予定 |
| CI/CD更新 | ⏳ 準備中 | GitHub Actions更新予定 |

---

## 🔄 Firestore→PostgreSQL 移行計画

1. **ETLスクリプト作成**: Firestoreデータを読み取り、PostgreSQLに投入
2. **冪等性確保**: 同じデータを何度実行しても同一結果
3. **検証**: 既存データとの一致確認
4. **段階切替**: Blue/Green デプロイで安全に移行

---

## 🤝 コントリビューション

1. `migrate/django` ブランチで開発
2. 機能追加・修正はプルリクエスト
3. テスト通過を確認してマージ

---

## 📞 サポート

質問や問題がある場合は、GitHubのIssueを作成してください。

