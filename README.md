

# 英単語クイズアプリ

---
## 🐳 開発環境セットアップ手順（Docker推奨）

### 1. 必要なツール
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [VSCode拡張: Docker](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-docker)（推奨）

---

### 2. リポジトリのクローン
```sh
git clone <このリポジトリのURL>
cd quiz-app
```

---

### 3. 環境変数ファイルの準備
- `backend/.env` および `frontend/.env.local` を編集
	- Google認証やDB接続情報を正しく設定

---

### 4. Dockerコンテナのビルド＆起動（開発環境）

#### 推奨方法：Makeコマンドを使用
```sh
make dev    # 開発環境の自動セットアップ
```

#### または手動でDocker Composeを使用
```sh
docker-compose up -d
```

#### 利用可能なMakeコマンド
```sh
make help          # 全コマンドのヘルプを表示
make build         # Dockerイメージをビルド
make up            # 環境を起動
make down          # 環境を停止
make logs          # 全サービスのログを表示
make logs-frontend # フロントエンドのログを表示
make logs-backend  # バックエンドのログを表示
make clean         # 全てを削除してリセット
```

#### アクセス先
- **フロントエンド**: http://localhost:3000
- **バックエンド API**: http://localhost:8080
- **データベース**: localhost:5432

- これで**3つのコンテナ**が起動します
	- `backend`（Django APIサーバー）
	- `frontend`（Next.jsフロントエンド）
	- `db`（PostgreSQL）

> ⚠️ `docker-compose up -d` や `make dev` だけで **Django/Next.jsサーバーも自動で起動** します。通常はこのコマンドだけで http://localhost:8080 (API) と http://localhost:3000 (フロント) にアクセスできます。
> 
> コードを修正・保存すると**自動的にホットリロードで反映**されます（DjangoもNext.jsもdevサーバーはホットリロード対応）。
> 
> サーバーを手動で再起動したい場合は `docker-compose restart backend` や `make restart` を使ってください。
> 
> **手動でrunserverやnpm run devを実行しないでください。** すでにサーバーが起動しているため、ポート競合エラーになります。

---


# 英単語クイズアプリ

![Tests](https://github.com/Fken19/quiz-app/actions/workflows/test.yml/badge.svg)

---

## 🚀 プロジェクト概要

このプロジェクトは、**Django REST Framework + Next.js + Supabase(PostgreSQL)** を用いた英単語クイズアプリです。生徒がGoogleアカウントでログインし、クイズ結果を記録・可視化できるよう設計されています。塾などの教育現場での使用を想定し、管理者（教師）機能も含みます。

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

- **users**: ユーザー情報（Google OAuth連携）
- **groups**: クラス・グループ管理
- **group_memberships**: グループメンバーシップ（生徒・管理者）
- **questions**: 英単語問題
- **options**: 選択肢（正解・不正解）
- **quiz_sessions**: クイズセッション
- **quiz_results**: 回答結果
- **daily_user_stats**: 日次ユーザー統計
- **daily_group_stats**: 日次グループ統計

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

