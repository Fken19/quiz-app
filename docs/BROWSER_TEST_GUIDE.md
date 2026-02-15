# ブラウザテスト手順書

## 前提
- ✅ Backend: docker compose up -d で起動（3000/3000でアクセス可能）
- ✅ Frontend: npm run dev で起動
- ✅ E2E_Quiz_TestA, TestB が DB に存在

---

## 🎯 テストフロー

### 1️⃣ テスト一覧表示
**URL**: http://localhost:3000/teacher/tests

**期待される状態**:
- [ ] ページが読み込まれる（404 なし）
- [ ] テーブルにテストが表示される
- [ ] 以下の列が見える：
  - ID
  - Title
  - Deadline
  - MaxAttempts
  - Status
  - **操作（Action） ← ここに「詳細」ボタンがある**

**確認項目**:
```
✓ E2E_Quiz_TestA が見える
✓ E2E_Quiz_TestB が見える
✓ 「詳細」ボタンがクリック可能（disabled でない）
✗ 行全体をクリックしようとしても反応しない（ボタンのみ反応）
```

---

### 2️⃣ テスト詳細ページ
**遷移方法**: テスト一覧から「詳細」ボタンをクリック → `/teacher/tests/[testId]`

**期待される状態**:
- [ ] ページが読み込まれる（404 なし）
- [ ] テスト情報を表示：
  - Title: E2E_Quiz_TestA
  - Description: （あれば）
  - Questions: 6 個表示
  
- [ ] **配信作成フォーム**が表示：
  ```
  Note: _________ （自由記述）
  MaxAttempts: __ （数値）
  Start At: ______ （日時）
  End At:   ______ （日時）
  [配信する] ボタン
  ```

- [ ] **既存配信一覧**が表示（最初は空）

**確認項目**:
```
✓ フォーム入力可能
✓ [配信する] ボタン クリック可能
✓ ブラウザコンソールに赤いエラーなし
```

---

### 3️⃣ 配信作成
**操作**: フォームに以下を入力 → [配信する]

```
Note: "Test Group A - attempt 2"
MaxAttempts: 2
Start At: 2026-02-15 20:00
End At:   2026-02-22 23:59
```

**期待される結果**:
- [ ] フォーム送信後、ページがリロード（または結果表示）
- [ ] ネットワークタブ: POST `/api/test-assignments` が **201 Created** を返す
- [ ] **配信一覧に新しい配信が追加される**
  ```
  ID | Note | StartAt | EndAt | MaxAttempts | [結果を見る]
  ```

**失敗時チェック**:
```
❌ 400 Bad Request → フォーム検証エラー（コンソール確認）
❌ 500 Internal Server Error → バックエンド error log を確認
❌ 401 Unauthorized → トークンがない（リロード試行）
```

---

### 4️⃣ 結果ページ
**遷移方法**: 配信一覧の「結果を見る」をクリック → `/teacher/test-assignments/[id]/results`

**期待される状態**:
- [ ] ページが読み込まれる（404 なし）
- [ ] 学生リスト表示（最初は空）
- [ ] **CSV ダウンロード** ボタンが存在

**確認項目**:
```
✓ ページレイアウト正常（崩れていない）
✓ ネットワークタブ: GET `/api/teacher/test-assignments/[id]/results` が 200 OK
✓ CSV ボタン クリック可能
```

---

## 🔧 デバッグチェックリスト

### ネットワークエラー（F12 → Network タブ）
```
❌ localhost:8080 への直接通信 → 修正対象
✓ localhost:3000/api/* への通信のみ
```

### コンソールエラー（F12 → Console タブ）
```
❌ CORS エラー → 修正対象
❌ Authorization Bearer エラー → token 確認
❌ 404 /teacher/tests → ファイル存在確認
```

### バックエンドログ
```bash
docker compose logs backend -f
# 500, 400 エラーが出ていないか確認
```

---

## 📊 テスト結果レポート

### 成功パターン 🟢
```
✓ 一覧表示 (200)
✓ 詳細ページ (200)
✓ 配信作成 (201)
✓ 結果表示 (200)
✓ ネットワーク: すべて 3000 経由
→ "UI導線 OK、E2E環境準備完了"
```

### 部分失敗パターン 🟡
```
✓ 一覧・詳細 OK
❌ 配信作成が 400 エラー
→ バックエンド serializer エラーログ確認
```

### 全失敗パターン 🔴
```
❌ 一覧ページが 404
→ ファイル確認: frontend/src/app/teacher/tests/page.tsx
```

---

## 💾 成功時のネクストステップ

1. **スクリーンショット**: 各画面をキャプチャして docs に保存
2. **Student 参加**: 別アカウントで受験フロー確認（オプション）
3. **Seed 自動化**: 環境変数化（Step 4）

---

**最後に**: UI が通ったら、`PHASE2_E2E_QA_STATUS.md` と `E2E_QA_AB_SETUP.md` を更新してください 📝
