# Phase 2.1: E2E受験フロー実装完了

## ✅ 実装内容

### Backend
- **StudentAttemptResultView**: `GET /api/student/attempts/{attempt_id}/result`
  - 受験結果の完全な取得
  - override_translations を適用した正解訳表示
  - 全問題の詳細データ（問題順序、選択肢、正否、反応時間）

### Frontend
1. **受験開始リダイレクト** (`/student/tests/[assignmentId]/attempt/page.tsx`)
   - 詳細ページから「受験を開始する」ボタンで起動
   - `startAttempt()` API実行 → attempt_id取得
   - 受験画面へ自動遷移

2. **受験画面** (`/student/tests/[assignmentId]/attempt/[attemptId]/page.tsx`)
   - ⏱️ タイマー（秒カウントダウン、時間超過時自動提出）
   - 1問ずつの表示と選択
   - 問題番号インジケータ（回答済み/未回答）
   - 次/前問題ナビゲーション
   - 最後の問題で「提出」ボタン
   - 回答履歴とタイミング計測

3. **結果表示画面** (`/student/tests/[assignmentId]/attempt/[attemptId]/result/page.tsx`)
   - スコア表示（100点満点）
   - 正解率（正解数/総問題数）
   - 所要時間
   - 問題別結果：
     - 英単語、あなたの答え、正解、正否
     - 正解時: ✓ 正解
     - 不正解時: ✗ 不正解 + 正解訳表示
     - 回答時間

## 🧪 E2E テスト手順

### 環境確認
```bash
# コンテナが全て起動している確認
docker compose ps
# 以下4つが Up でなければならない:
# - quiz-backend (8080)
# - quiz-db (5432)
# - quiz-frontend (3000)
```

### テスト実行フロー

#### 1. ブラウザアクセス
```
http://localhost:3000
```

#### 2. ログイン
- 学生アカウントでログイン
- ダッシュボード → 「受験する」 or `/student/tests`

#### 3. テスト選択
- 「テスト一覧」から利用可能なテストを選択
- 状態が「利用可能」のテストをクリック

#### 4. テスト詳細確認
- テストの説明と問題プレビューを確認
- 「受験を開始する」ボタンをクリック

#### 5. 受験実行
```
期待される動作:
✓ タイマーが開始される（秒単位でカウントダウン）
✓ 1番目の問題が表示される
✓ 選択肢が表示される（正解順序は隠されている）
✓ 選択肢をクリックすると、背景がハイライトされる
✓ 「次の問題」ボタンが有効になる
```

- 全問題で選択肢を選ぶ
- ナビゲーションボタンで問題間を移動
- 最後の問題で「提出」ボタンをクリック

#### 6. 結果表示
```
期待される動作:
✓ スコア（100点満点）が表示される
✓ 正解数/総問題数が表示される
✓ 所要時間が表示される
✓ 問題別に以下が表示:
  - 英単語
  - あなたの答え
  - 正解（不正解時のみ）
  - ✓/✗ アイコン
✓ 「テスト一覧に戻る」ボタンで元のページに戻る
```

## 🔍 API確認（Postman/curl例）

### 1. 受験開始
```bash
curl -X POST http://localhost:8080/api/student/tests/{assignment_id}/attempts/start/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"

# レスポンス:
{
  "attempt_id": "uuid",
  "attempt_no": 1,
  "timer_seconds": 30,
  "questions": [...]
}
```

### 2. 回答提出
```bash
curl -X POST http://localhost:8080/api/student/attempts/{attempt_id}/submit/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "answers": [
      {
        "question_order": 1,
        "choice_id": "choice-uuid",
        "reaction_time_ms": 5000
      },
      ...
    ]
  }'

# レスポンス:
{
  "attempt_id": "uuid",
  "score": 75,
  "total_questions": 4,
  "correct_count": 3,
  "total_time_ms": 25000,
  "answers": [...]
}
```

### 3. 結果取得
```bash
curl -X GET http://localhost:8080/api/student/attempts/{attempt_id}/result/ \
  -H "Authorization: Bearer <token>"

# レスポンス:
{
  "attempt_id": "uuid",
  "assignment_id": "uuid",
  "test_id": "uuid",
  "test_title": "テスト名",
  "attempt_no": 1,
  "started_at": "2025-02-15T10:00:00+09:00",
  "completed_at": "2025-02-15T10:05:00+09:00",
  "score": 75,
  "total_questions": 4,
  "correct_count": 3,
  "total_time_ms": 300000,
  "details": [
    {
      "question_order": 1,
      "vocabulary_id": "uuid",
      "english_word": "apple",
      "selected_choice_id": "choice-uuid",
      "selected_text_ja": "りんご",
      "is_correct": true,
      "correct_text_ja": "りんご",
      "reaction_time_ms": 5000
    },
    ...
  ]
}
```

## ✨ 機能チェックリスト

### 受験開始
- [ ] テスト詳細ページから「受験を開始する」をクリック
- [ ] 受験画面へ自動遷移
- [ ] タイマーが表示される
- [ ] 1番目の問題が表示される

### 受験進行
- [ ] 選択肢をクリックすると選択状態になる
- [ ] 「次の問題」ボタンで進む
- [ ] 「前の問題」ボタンで戻る
- [ ] 問題インジケータに回答済み状態が反映される
- [ ] 直接問題番号をクリックして移動できる

### 提出・結果
- [ ] 全問題回答後、「提出」ボタンがクリック可能
- [ ] 提出後、結果ページに遷移
- [ ] スコアと正解数が表示される
- [ ] 不正解した問題で正解訳が表示される
- [ ] 「テスト一覧に戻る」で戻れる

## 📝 コミット内容

```
commit ef050c1
Phase 2.1: 完全なE2E受験フロー実装（受験画面・結果表示・API統合）

- Backend: StudentAttemptResultView (GET /api/student/attempts/{attempt_id}/result)
- Frontend: 受験開始リダイレクト、受験画面、結果表示画面
- 型定義とAPI関数の完全実装
- E2E フロー: 詳細 → 受験開始 → 回答 → 提出 → 結果表示
```

## 🚀 次のステップ（オプション）

- [ ] マルチ配信テストでの複数受験制限確認
- [ ] タイムアップ時の自動提出確認
- [ ] 未回答問題の扱い確認
- [ ] CSV エクスポート機能（教師向け）
- [ ] 結果フィードバック機能（教師向け）
