![Tests](https://github.com/Fken19/quiz-app/actions/workflows/test.yml/badge.svg)

# クイズアプリ README

## 📌 プロジェクト概要
このプロジェクトは、Flask + Google OAuth 認証 + Firestore を用いた英単語クイズアプリです。生徒が Google アカウントでログインし、自分のクイズ結果を記録・可視化できるよう設計されています。将来的には塾などの教育現場での使用を想定し、管理者（教師）機能の追加も視野に入れています。

---

## ✅ 現在の構成・機能
- フレームワーク: Flask (gunicorn + Cloud Run 本番対応)
- 認証: Google OAuth (`google-auth`, `requests-oauthlib` による自作認証)
- セッション管理: Flask-Session + Redis（Render/Cloud Run 両対応）
- データベース: Google Firestore（ユーザー情報 + クイズ結果管理）
- フロント: HTML (Jinja2) + Chart.js
- 時間帯: JST に統一（グラフ表示や履歴表示に反映）

---

## 🔧 開発・運用で直面した主な課題と対応

### 1. Google OAuth 認証の不安定さ
- Flask-Dance による認証で `redirect_uri_mismatch`, `リダイレクトループ`, `invalid_client` エラーが頻発
- 対応: Flask-Dance を完全に廃止し、`google-auth` ベースの独自OAuth実装に移行（PC・スマホ対応確認済）

### 2. サーバーサイドセッションの確立
- Flask 標準セッションではスケーラビリティに限界 → Redis を導入
- Render 本番環境や Cloud Run 上でも安定動作を確認

### 3. Cloud Run 本番デプロイの構築
- gunicorn 使用、PORT:8080 にバインド、HTTPS 統一、環境変数による設定管理
- 起動・ログイン成功を確認し、本番URLによる運用が可能に

### 4. GitHub ActionsによるCI/CD整備
- push/pull request時に自動でpytestテストを実行
- mainブランチにマージされるとCloud Runへ自動デプロイ
- テスト通過確認後にのみデプロイされるため安全性も向上

---

## 🗂️ ディレクトリ構成
quiz-app/
├── app.py
├── auth_routes.py
├── create_db.py
├── firestore_client.py
├── extensions.py
├── models.py
├── templates/
│   ├── base.html
│   ├── index.html
│   ├── level_selection.html
│   ├── segment_selection.html
│   ├── results.html
│   ├── dashboard.html
│   ├── result_detail.html
├── static/
│   ├── app.js
├── english_firestore_key.json
├── .env（ローカル開発用）
├── Dockerfile
├── Dockerfile.test
├── docker-compose.yml
├── requirements.txt
├── .github/workflows/
│   ├── test.yml
│   ├── deploy.yml

---

## 📈 今後の課題と現在の状況

| 課題カテゴリ             | 現在の進捗 | 補足                                           |
|----------------------------|------------|------------------------------------------------|
| Google OAuth認証           | ✅ 解決済   | Flask-Dance 廃止→独自実装でPC/スマホ対応       |
| Redisセッション管理        | ✅ 済       | 安定動作確認済み                               |
| ユニットテスト導入         | ⏳ 一部対応 | pytest導入済、CI上で実行中                     |
| UI/UX改善                  | ⏳ 一部対応 | デザインやスマホ最適化は継続課題               |
| 管理者機能                 | ❌ 未対応   | 機能要件は設計済、実装はこれから               |
| 成績分析機能               | ⏳ 一部対応 | 日次集計あり、高度化に着手可能                 |
| Cloud Run本番体制          | ✅ 済       | HTTPS、gunicorn、PORT:8080バインド対応済       |
| セキュリティ・env管理      | ✅ 済       | cookie等のセキュリティ強化は今後               |
| GitHub ActionsによるCI/CD  | ✅ 済       | テスト＋デプロイ自動化済、本番環境と連携       |
| スケーリング対応           | ❌ 未対応   | 将来的なアクセス増への備えが必要               |

---

## 💡 将来的な拡張予定
- 管理者用UI・認証機能（特定メールのみアクセス可能）
- 管理者による個別テストの作成・配信
- ユーザー毎の不正解傾向分析、レコメンド機能
- Memorystore導入やPub/Subによるスケーラブルな非同期処理

---# デプロイテスト 2025年 4月27日 日曜日 12時43分30秒 JST
# デプロイ最終テスト 2025年 4月27日 日曜日 12時56分25秒 JST
# デプロイ最終確認 2025年 4月27日 日曜日 13時09分24秒 JST
