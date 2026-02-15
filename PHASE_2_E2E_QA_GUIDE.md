# Phase 2 E2E QA 実施ガイド

このガイドは [PHASE_2_E2E_QA.md](PHASE_2_E2E_QA.md) を使用してQAを実施する際の補足情報です。

---

## 📋 QA実施の流れ

### 1. 準備（5分）
1. Docker環境起動確認
2. PHASE_2_E2E_QA.md をコピーして記入用ファイルを作成
3. 講師・学生アカウントを準備

### 2. データ作成（15分）
1. 講師でログイン
2. テスト作成（4-8問）
3. 配信A作成（max_attempts=2）
4. 配信B作成（max_attempts=3、同じtest使用）
5. 学生5名を両配信に割り当て

### 3. 学生側テスト（30分）
- 学生1: 配信Aを2回（2回目は未回答含む）、配信Bを1回
- 学生2: 配信Aを1回、配信Bは未受験
- 学生3: 全て未受験

### 4. 講師側確認（20分）
- 配信A/Bの結果一覧確認
- フィルタ・ソート動作確認
- CSVダウンロード＋Excel確認

### 5. 境界条件（10分）
- 期限切れ配信
- 回数上限
- タイムアップ
- 二重開始

**合計所要時間**: 約80分

---

## 🎯 重点確認項目（絶対に落としてはいけない）

### P0-1: assignment単位の独立性
```
配信Aで2回受験 → 配信Bの残り回数が減らない
配信Aの結果一覧 → 配信Bの受験が混ざらない
```

### P0-2: 未回答の扱い
```
choice_id=null で submit → 500エラーにならない
result画面 → "(未回答)" と表示される
TestResultDetail.selected_choice → NULL で保存される
```

### P0-3: 未受験者の表示
```
JSON一覧 → 未受験者が行として表示される
CSV → 未受験者の行が含まれる（得点は空欄）
```

### P0-4: CSV文字化け防止
```
Excel で開く → 日本語が正しく表示される
BOM付きUTF-8 → Content-Type/Disposition が正しい
```

---

## 🔧 よくある問題と対処法

### 問題1: 配信A/Bの回数が混ざる

**現象**: 配信Aで2回受験したら、配信Bの残り回数も減った

**原因**: TestResult集計が test_id + student_id になっている

**確認方法**:
```sql
-- DBで確認
SELECT test_id, test_assignee_id, COUNT(*) 
FROM test_results 
WHERE student_id = '学生1のID' 
GROUP BY test_id, test_assignee_id;
```

**対処**: views.py の集計ロジックを test_assignee_id で絞る

---

### 問題2: 未回答で500エラー

**現象**: 未回答を含めて提出すると500エラー

**原因**: choice_id が必須になっている、または selected_choice の null 処理不足

**確認方法**:
```bash
# Backend ログ確認
docker compose logs backend | grep -A 10 "500"
```

**対処**: StudentAttemptSubmitView で choice_id=null を許容

---

### 問題3: 未受験者が一覧に出ない

**現象**: 講師結果一覧で、未受験者が表示されない

**原因**: 母集団が TestResult になっている（TestAssignee ではない）

**確認方法**: 結果一覧の表示件数が TestAssignee 件数より少ない

**対処**: TeacherAssignmentResultsView の集計を TestAssignee 母集団に修正

---

### 問題4: CSVが文字化け

**現象**: Excel で開くと日本語が文字化けする

**原因**: BOM なし、または Content-Type が不適切

**確認方法**:
```bash
# CSVの先頭バイトを確認（BOMがあれば ef bb bf）
xxd test_results_*.csv | head -1
```

**対処**: 
```python
output.write('\ufeff')  # BOM追加
response['Content-Type'] = 'text/csv; charset=utf-8'
```

---

### 問題5: 他講師のassignmentが見える

**現象**: 講師Aで講師Bのassignment結果が見える

**原因**: assignment取得時の所有者チェックが不足

**対処**: 
```python
if assignment.assigned_by_teacher.user_id != user.id:
    raise PermissionDenied()
```

---

## 📊 データ整合性確認SQL

### TestResult の test_assignee 確認
```sql
SELECT 
    tr.id,
    tr.test_id,
    tr.student_id,
    tr.test_assignee_id,
    tr.attempt_no,
    tr.completed_at,
    ta.test_assignment_id
FROM test_results tr
JOIN test_assignees ta ON tr.test_assignee_id = ta.id
WHERE tr.student_id = '学生1のID'
ORDER BY tr.created_at;
```

### TestResultDetail の未回答確認
```sql
SELECT 
    trd.id,
    trd.test_result_id,
    trd.question_order,
    trd.selected_choice_id,
    trd.selected_text,
    trd.is_correct,
    trd.reaction_time_ms
FROM test_result_details trd
WHERE trd.test_result_id = '未回答含む試行のID'
ORDER BY trd.question_order;
```

### TestAssignee の割り当て確認
```sql
SELECT 
    ta.id,
    ta.test_assignment_id,
    ta.student_id,
    u.name,
    u.email,
    COUNT(tr.id) as attempt_count,
    COUNT(CASE WHEN tr.completed_at IS NOT NULL THEN 1 END) as completed_count
FROM test_assignees ta
JOIN users u ON ta.student_id = u.user_id
LEFT JOIN test_results tr ON tr.test_assignee_id = ta.id
WHERE ta.test_assignment_id = '配信AのID'
GROUP BY ta.id, ta.test_assignment_id, ta.student_id, u.name, u.email;
```

---

## 🐛 デバッグ方法

### Backend ログ確認
```bash
# リアルタイムログ
docker compose logs -f backend

# エラーログのみ
docker compose logs backend | grep -i error

# 特定APIのログ
docker compose logs backend | grep "StudentAttemptSubmitView"
```

### Frontend ログ確認
```bash
# ブラウザ DevTools Console を開く
# Network タブで API リクエスト/レスポンスを確認
```

### DB直接確認
```bash
# psql に接続
docker compose exec db psql -U postgres -d quiz_db

# または SQLite の場合
docker compose exec backend python manage.py dbshell
```

---

## ✅ 合格判定フローチャート

```
全P0項目合格？
  ├─ YES → MVP完了！README更新へ
  └─ NO → 不具合の優先度を確認
           ├─ P0（必須）→ 即座に修正
           ├─ P1（推奨）→ 記録して後回し可
           └─ P2（軽微）→ 記録のみ
```

---

## 📝 結果報告テンプレート

### 合格の場合
```
## Phase 2 E2E QA 結果報告

**実施日**: 2026-02-15
**実施者**: [名前]
**結果**: ✅ 合格（MVP完了）

### 実施内容
- 環境: Docker Compose
- データ: テスト1本、配信2本、学生5名
- シナリオ: 全項目実施

### 確認項目
- ✅ assignment単位の独立性
- ✅ 未回答対応
- ✅ 未受験者表示
- ✅ CSV出力（文字化けなし）
- ✅ 権限確認
- ✅ 境界条件

### 次のアクション
- README更新（使い方・API一覧）
- 本番デプロイ準備
```

### 不合格の場合
```
## Phase 2 E2E QA 結果報告

**実施日**: 2026-02-15
**実施者**: [名前]
**結果**: ❌ 不合格

### 発見された問題

#### 問題1: [タイトル]
- **優先度**: P0
- **現象**: [詳細]
- **再現手順**: [手順]
- **対処方針**: [方針]

### 次のアクション
- 問題1修正 → 再QA
```

---

## 🚀 QA合格後の作業

1. **README.md更新**
   - テスト機能の使い方
   - API一覧（学生/講師）
   - CSV仕様
   - 制約事項

2. **本番デプロイ準備**
   - 環境変数確認
   - migration適用手順
   - 初期データ投入

3. **運用ドキュメント作成**
   - 講師向けマニュアル
   - 学生向けマニュアル
   - トラブルシューティング

---

**このガイドを使用して PHASE_2_E2E_QA.md を埋めてください。**

**所要時間**: 約80分  
**推奨**: 2名でペア実施（1名操作、1名記録）
