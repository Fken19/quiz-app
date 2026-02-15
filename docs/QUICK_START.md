# Phase 2 E2E QA - クイックスタート（2026-02-15版）

## ⚡ 30秒要約

- **Test複製完了**: E2E_Quiz_TestA と E2E_Quiz_TestB が DB に存在
- **DB変更なし**: unique constraint (test, student) のまま動作
- **UI導線完成**: tests → detail → assignment create → results フロー実装済み
- **準備完了**: ブラウザテスト実行可能な状態

---

## 🎯 使い方（推奨フロー）

### Step 1: ブラウザで UI 導線を確認（最初はこれ）

```
http://localhost:3000/teacher/tests
```

詳細は [docs/BROWSER_TEST_GUIDE.md](BROWSER_TEST_GUIDE.md) を参照。

**成功基準**: tests → detail → create → results を 404/500 なしで回れること

### Step 2: 追加の Test が必要な場合（新しい A/B テスト）

**管理コマンド版**（推奨）:
```bash
# プレビュー（何も作らない）
docker compose exec -T backend python manage.py duplicate_test <SOURCE_ID> --dry-run

# 新テスト作成（TestC, TestD, ... 用）
docker compose exec -T backend python manage.py duplicate_test <SOURCE_ID> --title-suffix " (C)"

# カスタムタイトル
docker compose exec -T backend python manage.py duplicate_test <SOURCE_ID> --new-title "E2E用テスト_カスタム"

# 同名が存在する場合は失敗する（安全設計）
# 強制的に上書きするには --force を付ける
docker compose exec -T backend python manage.py duplicate_test <SOURCE_ID> --force
```

**オプション解説**:
- `--title-suffix TEXT`: タイトルに追記（デフォルト: " (copy)"）
- `--new-title TEXT`: カスタムタイトルで上書き
- `--dry-run`: 実行しないでプレビュー（テスト確認用）
- `--force`: 同名テストが存在しても作成

### Step 3: 配信作成テスト（curl例）

Token を使わない方法（same-origin 前提）:

```bash
# ブラウザで /teacher/tests/[testId] にアクセス
# フォームで以下を入力:
# - Note: "Test Group A"
# - MaxAttempts: 2
# - Start/End: 自動入力（または任意）
# - [配信する] をクリック

# または curl で確認（API スキーマテスト用）:
curl -X POST http://localhost:3000/api/test-assignments \
  -H "Content-Type: application/json" \
  -d '{
    "test": "d86eb90e-2944-44cf-9813-3c1b59e89ff5",
    "note": "API Schema Test",
    "run_params": {
      "run_params": {
        "schema_version": 1,
        "timezone": "Asia/Tokyo",
        "schedule": {
          "start_at": "2026-02-15T20:00:00+09:00",
          "end_at": "2026-02-22T23:59:59+09:00"
        },
        "timer": {"mode": "uniform", "seconds": 10},
        "attempts": {
          "default_max_attempts": 2,
          "source_of_truth": "testassignee"
        }
      }
    }
  }'

# 201 Created で成功
```

---

## 📚 ドキュメント（参考リンク）

| ファイル | 用途 |
|---------|------|
| [BROWSER_TEST_GUIDE.md](BROWSER_TEST_GUIDE.md) | ブラウザテスト手順・デバッグ方法 |
| [E2E_QA_AB_SETUP.md](E2E_QA_AB_SETUP.md) | A/B テスト設計・スキーマ・制限事項 |

---

## 🔐 セキュリティ・運用ルール（重要）

### 禁止事項 ❌

- **コード/ドキュメント内に個人メール埋め込み**
- **Token/Bearer を docs に記載**
- **固定 UUID をスクリプトに埋め込み**

### 推奨 ✅

- Token が必要な場合 → 環境変数 (`QA_SEED_TEACHER_EMAIL` など)
- seed データ → `.env` で管理（`.env.example` のみ repo）
- ローカル実行ファイル → `.gitignore` に追加

### 例：.env 化

```bash
# .env
QA_SEED_TEACHER_EMAIL=teacher@example.com
QA_SEED_STUDENTS=student1@example.com,student2@example.com

# コード内
import os
teacher_email = os.getenv('QA_SEED_TEACHER_EMAIL', 'default@example.com')
```

---

## 🚀 次フェーズ（時間があれば）

1. **Seed 自動化**: 環境変数で teacher/students を指定
2. **Debug endpoint 安全化**: `/api/debug/*` は `DEBUG=True` のみ
3. **Student E2E**: 学生受験フロー検証

---

## 💾 現在の A/B テスト

| テスト | ID | 問題数 | 割当数 | 用途 |
|--------|----|----|------|------|
| E2E_Quiz_TestA | d86eb90e-2944-44cf-9813-3c1b59e89ff5 | 6 | 0 | Group A テスト用 |
| E2E_Quiz_TestB | 11952b52-cdbd-472e-bbd2-c0066d40b13c | 6 | 0 | Group B テスト用 |

---

## 🔧 トラブル時

| 症状 | 対処 |
|------|------|
| `404 /teacher/tests` | ファイル確認: `frontend/src/app/teacher/tests/page.tsx` |
| `500 POST /api/test-assignments` | `docker compose logs backend` で serializer エラー確認 |
| 複製コマンドが失敗 | `--help` で引数確認、`--dry-run` で事前検証 |

---

## 🎯 成功の見分け方

### 🟢 全て OK
```
✓ /teacher/tests → 一覧表示
✓ 「詳細」ボタン → /teacher/tests/[testId] へ遷移
✓ フォーム送信 → 201 Created
✓ 結果ページ → /teacher/test-assignments/[id]/results で表示
```

### 🔴 問題がある
```
❌ 404 エラー → ファイル存在確認
❌ 500 エラー → バックエンド ログ確認
❌ POST が 400 → run_params スキーマ確認
```

---

**最後に**: ブラウザテストを実施してください。
詳細は [BROWSER_TEST_GUIDE.md](BROWSER_TEST_GUIDE.md) を参照。

