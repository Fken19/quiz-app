

# 英単語クイズアプリ — 中学生向け学習プラットフォーム

![Backend Tests](https://github.com/Fken19/quiz-app/actions/workflows/backend-test.yml/badge.svg)
![Full Stack Tests](https://github.com/Fken19/quiz-app/actions/workflows/test.yml/badge.svg)
![Deploy Status](https://github.com/Fken19/quiz-app/actions/workflows/deploy.yml/badge.svg)

---

## 📖 このアプリについて

### なぜ作ったのか

学習塾でのアルバイト経験から、中学生の**英単語力不足**という課題に直面しました。中学生には専用の英単語帳がなく、教科書の付録程度の語彙しか学習手段がありません。また、塾では授業冒頭に単語テストを実施しますが、**貴重な授業時間を暗記テストに使うのは非効率**です。

そこで、自身がTOEICや大学受験で効果を実感した**「スマホ×短時間反復学習」**を中学生向けに最適化し、次の3つの目的を実現するアプリを開発しました：

1. **英単語力の底上げ** — 日常的に短時間で反復できる仕組みで、継続コストを最小化
2. **スマホ中心の学習体験** — 机やPCなしで、いつでもどこでも学習開始
3. **授業時間の最適化** — 単語テストを事前オンライン化し、授業は応用・解説に集中

また、予算制約のある学習塾でも導入できるよう、**外部SaaSに依存しない自前の管理機能**を備えています。

---

## 🎯 アプリの特徴

### 🔐 セキュアで透明性の高い認証設計

- **Google OAuth必須** — 信頼性の高い外部認証で個人情報保護とセキュリティを両立
- **講師の2段階認証** — Googleログイン + 開発者ホワイトリスト照合で不正利用を防止
- **生徒の自己決定権** — 講師による監視は生徒の承認が必須。いつでも解除可能で透明性を確保

### 📱 スマホ最適化の学習体験

- **レスポンシブWebアプリ** — iOS/Android両対応、アプリ配布・審査不要
- **URL + QRコード配布** — 塾生以外でも自習利用可能（講師監視は承認制）
- **生徒用・講師用URLを分離** — UIレベルで誤操作を防止（セキュリティはAPI側で厳格管理）

### 🧠 学習の質を高める設計

- **10秒タイマー** — 即答力を鍛え、考え込みすぎを防止（講師テストは可変設定可）
- **4択縦並び** — スマホでの視認性とタップ距離を最適化
- **位置ランダム化** — 毎回選択肢の順序を変更し、位置記憶を無効化
- **タップ必須遷移** — 自動遷移なしで学習者の主導感を維持
- **フォーカス学習** — 「苦手だけ10問」「未学習だけ10問」など、弱点に集中した学習が可能
- **学習ステータス可視化** — 未学習/苦手/学習済み/得意を直近履歴から自動判定

### 📊 モチベーション維持の仕組み

- **学習ダッシュボード** — 日/週/月の学習量を積み上げ棒グラフで可視化（正解・不正解・Timeout内訳付き）
- **Streak（連続学習日数）** — 習慣化を促す可視報酬
- **直近7日ヒートマップ** — 学習リズムを一目で把握

### 👨‍🏫 講師向け管理機能

- **生徒管理** — 学校・学年・クラス等の定義済みラベル + 任意タグで柔軟に絞り込み・ソート
- **招待トークン方式** — 6〜8桁の短期有効コードで安全に生徒を紐付け（QRコード対応）
- **テスト作成・配信** — 任意の単語でテスト作成、作成済みテストは再利用可能
- **学習進捗の把握** — 生徒単位・クラス単位で学習状況を確認

### 🛡️ プライバシー保護

- **同意フロー** — 講師の閲覧権限は生徒の明示的な承認が必要
- **承認/解除履歴** — 生徒はいつでも管理講師を確認・解除可能
- **公開ランキング非搭載** — データ流出や不必要な競争を防止

### 🔧 品質改善サイクル

- **問題の指摘機能** — 生徒が誤訳や不適切な選択肢を報告可能
- **サーバー側正誤判定** — クライアント側に正解を渡さず、不正解答を防止

---

## ✅ 実装状況

### 🟢 実装済み（バックエンド）

- ✅ Django REST Framework + PostgreSQL 15
- ✅ Google OAuth認証（NextAuth.js + Django連携）
- ✅ 講師ホワイトリスト認証
- ✅ ユーザー管理（生徒・講師）
- ✅ 語彙・クイズデータモデル（レベル・セクション構成）
- ✅ クイズセッション・回答記録
- ✅ 学習進捗集計（正解・不正解・Timeout、Streak、JST基準の日付集計）
- ✅ 学習者用語彙一覧・詳細API（ステータス、学習履歴付き）
- ✅ 語彙の誤り報告機能（カテゴリ別、レート制限、通知連携）
- ✅ 招待トークン発行・承認システム
- ✅ テスト作成・配信機能
- ✅ Django管理画面（ホワイトリスト登録、データ管理）
- ✅ Docker開発環境
- ✅ CI/CD（GitHub Actions）
- ✅ GCP Cloud Runデプロイ

### 🟢 実装済み（フロントエンド）

- ✅ Next.js 15（App Router、TypeScript、Tailwind CSS）
- ✅ 生徒用UI（ログイン、レベル・セクション選択、クイズ画面、結果詳細）
- ✅ 学習ダッシュボード（日/週/月棒グラフ、Streak表示、JST日付修正済み、直近371日ヒートマップ）
- ✅ 語彙一覧・詳細ページ（学習ステータス、履歴、例文表示）
- ✅ 結果画面から語彙詳細への遷移（戻るボタン対応）
- ✅ 語彙の誤り報告フォーム（インライン展開、カテゴリ選択、成功フィードバック）
- ✅ 講師用UI（生徒管理、テスト作成、招待コード発行）
- ✅ レスポンシブデザイン（スマホ最適化、タップ領域考慮）
- ✅ アクセシビリティ対応（キーボード操作、role属性、focusリング）

### 🔴 未実装・検討中

- ❌ 承認/解除履歴UI（タイムライン表示）
- ❌ 講師テストの可変タイマー設定UI
- ❌ 利用規約・プライバシー同意フロー
- ❌ E2Eテスト（Playwright）
- 🔵 LLM自動ダミー生成（将来検討）
- 🔵 教科書準拠マッピング（将来検討）
- 🔵 スマホアプリ化（PWA対応）

---

## 🏗️ 技術スタック

- **バックエンド**: Django 4.2+ REST Framework + PostgreSQL 15
- **フロントエンド**: Next.js 15 (App Router, TypeScript, TanStack Query, Tailwind CSS)
- **認証**: Google OAuth2（NextAuth.js + Django連携）
- **インフラ**: Docker Compose（開発）/ GCP Cloud Run（本番）
- **CI/CD**: GitHub Actions
- **データベース**: PostgreSQL 15（論理削除、UUID主キー採用）

---

## 📁 ディレクトリ構成

```
quiz-app/
├── backend/                    # Django REST API
│   ├── quiz_backend/          # Django設定
│   ├── quiz/                  # メインアプリ（models, views, serializers）
│   ├── manage.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                  # Next.jsフロントエンド
│   ├── src/
│   │   ├── app/              # App Router（ページ）
│   │   ├── components/       # 共通コンポーネント
│   │   ├── lib/              # API、認証ロジック
│   │   └── types/            # TypeScript型定義
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml         # 開発用コンテナ定義
├── Makefile                   # 開発補助コマンド
└── README.md
```

---

## 🐳 開発環境セットアップ

### 1. 必要なツール

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### 2. リポジトリのクローン

```sh
git clone <このリポジトリのURL>
cd quiz-app
```

### 3. 環境変数ファイルの準備

`backend/.env` および `frontend/.env.local` を作成し、以下の情報を設定：

**`frontend/.env.local`**
```env
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_API_URL_BROWSER=http://localhost:8080
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
NEXTAUTH_SECRET=xxx
```

**`backend/.env`**
```env
DJANGO_SECRET_KEY=xxx
DJANGO_ALLOWED_HOSTS=*
POSTGRES_DB=quiz_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
```

### 4. Dockerコンテナの起動

```sh
docker-compose up -d
```

### 5. マイグレーション・管理ユーザー作成

```sh
docker-compose exec backend python manage.py migrate
docker-compose exec backend python manage.py createsuperuser
```

### 6. 動作確認

- **フロントエンド**: http://localhost:3000
- **バックエンドAPI**: http://localhost:8080
- **Django管理画面**: http://localhost:8080/admin/

### 7. よく使うコマンド

```sh
# バックエンドのシェル
docker-compose exec backend bash

# フロントエンドのシェル
docker-compose exec frontend sh

# ログ確認
docker-compose logs -f

# コンテナ停止
docker-compose down
```

> ⚠️ ローカルで直接 `python` や `npm` を実行せず、**必ずコンテナ内で作業**してください。

---

## 🌐 主なAPIエンドポイント

### 認証
- `POST /api/auth/google/` - Google OAuth認証
- `GET /api/auth/me/` - 現在のユーザー情報

### 学習者向け
- `GET /api/vocabularies/` - 語彙一覧
- `GET /api/student/vocab/` - 学習者用語彙一覧（ステータス・履歴付き）
- `GET /api/student/vocab/{id}/` - 語彙詳細（訳・例文・学習状況）
- `POST /api/student/vocab/{id}/report/` - 語彙の誤り報告
- `POST /api/quiz-sessions/` - クイズセッション開始
- `POST /api/quiz-sessions/{id}/submit-answer/` - 回答送信
- `POST /api/quiz-sessions/{id}/complete/` - セッション完了
- `GET /api/student/dashboard-summary/` - ダッシュボード統計（Streak、日/週/月集計）
- `GET /api/learning-progress/` - 学習進捗取得

### 講師向け（ホワイトリスト必須）

> **重要**: Django管理画面（`/admin/`）からホワイトリスト登録が必要です。

- `GET /api/teacher-profiles/` - 講師プロフィール
- `POST /api/invitation-codes/` - 招待コード発行
- `GET /api/roster-students/` - 管理生徒一覧
- `POST /api/tests/` - テスト作成
- `GET /api/student-progress/{student_id}/` - 生徒の学習状況

---

## 🧪 テスト・CI/CD

### GitHub Actions

- **Full Stack Tests** — バックエンド（スキーマ、マイグレーション）+ フロントエンド（TypeScriptビルド）
- **Backend Integration Tests** — PostgreSQL統合テスト、モデル検証
- **Deploy to GCP** — Cloud Runへの自動デプロイ（`main`ブランチ）

### ローカルテスト

```sh
# バックエンド
docker-compose exec backend python manage.py test

# フロントエンド
docker-compose exec frontend npm run build
```

---

## 🎓 主な機能フロー

### 生徒側

1. 生徒用URLにアクセス → Googleログイン
2. ユーザーホーム（塾管理下の場合は連絡・テスト・Streakを表示）
3. 「英単語クイズに進む」→ レベル選択 → セクション選択（10問単位 or レベル内ランダム）
4. クイズ開始（英単語 → 日本語4択、10秒タイマー）
5. 判定表示（◯/×/Timeout）→ どこでもタップで次へ
6. セクション結果表示 → 次のセクション or レベル一覧
7. ダッシュボードで学習量を可視化
8. プロフィールで管理講師を確認・解除可能

### 講師側

1. 講師用URLにアクセス → Googleログイン + ホワイトリスト照合
2. 講師ホーム（生徒一覧、生徒追加、テスト作成）
3. 招待トークン発行 → 生徒に配布（QRコード可）
4. 生徒が承認 → 学習状況の確認が可能に
5. テスト作成 → 生徒・クラス・学年単位で配信
6. 作成済みテストは再利用可能

---

## 🔒 セキュリティ・プライバシー

- **サーバー側正誤判定** — クライアントに正解ラベルを渡さない
- **Django管理画面** — ホワイトリスト登録、データ変更は管理者のみ（ポート8080）
- **講師の閲覧権限** — 生徒の承認が必須、いつでも解除可能
- **匿名利用不可** — Google認証必須

---

## 🤝 コントリビューション

1. ブランチを切って開発
2. プルリクエストを作成
3. CI/CDテスト通過を確認してマージ

---

## 📞 サポート

質問や問題がある場合は、GitHubのIssueを作成してください。

