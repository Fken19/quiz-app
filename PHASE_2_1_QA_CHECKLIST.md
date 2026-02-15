# Phase 2.1 QA チェックリスト

## 実装状況の確認結果

### ✅ 実装済み（確認完了）
- [x] `TestResultDetail.selected_choice` (FK) でchoice_idを保存
- [x] `TestResultDetail.selected_text` で選択した訳文を保存
- [x] `TestResultDetail.is_correct` で正誤を保存
- [x] `TestResultDetail.reaction_time_ms` で反応時間を保存
- [x] `TestResult.test_assignee` で配信単位の紐付け（assignment単位保証）
- [x] result API で override_translations を適用した正解訳を返す

### ❌ 未実装（Phase 2.1で修正必要）

#### 1. 未回答の扱い（P0 - 必須修正）
**現状**: `choice_id` が必須。null を送ると 500 エラー

**必要な修正**:
```python
# StudentAttemptSubmitView で以下を実装：
1. choice_id が null の場合を許容
2. selected_choice=None, is_correct=False で TestResultDetail を作成
3. 未回答は不正解扱いとする
```

**APIリクエスト形式の決定**:
- オプションA: `{"question_order": 1, "choice_id": null, "reaction_time_ms": null}`
- オプションB: answers配列から未回答問題を除外、サーバ側で補完
→ **推奨: オプションA（明示的にnullを送る）** - クライアント実装がシンプル

#### 2. タイムアップ時の自動提出（P1 - 動作確認必要）
**現状**: フロントでタイムアップ時に `handleTimeUp()` → `handleSubmit()` を呼ぶ

**確認項目**:
- [ ] タイムアップ時に未回答がある場合、choice_id=null で送信される
- [ ] reaction_time_ms は実測値（timer_secondsではなく実際の経過時間）

#### 3. 二重開始の防止（P1 - 推奨実装）
**現状**: 未実装（ボタン連打で複数attempt作成の可能性）

**推奨修正**:
```typescript
// Frontend: 開始ボタンをクリック時にdisable
const [isStarting, setIsStarting] = useState(false);

// Backend: 短時間の重複開始をガード（オプション）
# 同一assignmentで started_at が直近5分以内の未完了attemptがあれば拒否
```

---

## QA実施項目

### 1.1 基本フロー（必須）

#### テストデータ準備
```sql
-- 同一testの複数配信を作成
-- assignment A: 2026-02-15 09:00 - 2026-02-20 23:59, max_attempts=2
-- assignment B: 2026-02-16 09:00 - 2026-02-25 23:59, max_attempts=3
```

- [ ] **学生 `/student/tests` に複数配信が別行で表示される**
  - assignment A, assignment B が別々のカードで表示
  - 各カードに独立した期限・残り回数が表示

- [ ] **各配信の詳細へ遷移し、情報が正しい**
  - assignment A: 残り回数 2/2
  - assignment B: 残り回数 3/3
  - 期限が異なる

- [ ] **受験フロー完全実行**
  - 詳細 → 「受験開始」 → attempt画面 → 全問回答 → 提出 → result画面
  - スコアが表示される
  - 正誤判定が正しい
  - 反応時間が表示される

### 1.2 境界条件（必須）

#### 期限外
- [ ] **start前の配信**
  - 一覧で「受験期間前」と表示
  - 詳細ページで「受験開始」ボタンが無効化またはエラー表示
  - start API が 403 で拒否

- [ ] **end後の配信**
  - 一覧で「期限切れ」と表示
  - start API が 403 で拒否

#### attempts上限
- [ ] **上限到達後**
  - assignment A で 2回受験後、3回目の start が拒否される
  - 一覧の残り回数が 0/2 と表示
  - 詳細ページで「受験回数の上限に達しました」表示

- [ ] **assignment単位の独立性**
  - assignment A で2回受験済み
  - assignment B では 3/3 のまま（影響を受けない）

#### override_translations
- [ ] **採点での反映**
  - override した語彙の選択肢が正解として判定される
  - 元の訳が選ばれた場合は不正解

- [ ] **result表示での反映**
  - correct_text_ja に override訳が表示される
  - selected_text_ja は選択した選択肢の訳

### 1.3 事故防止（推奨）

#### 二重開始
- [ ] **ボタン連打**
  - 「受験開始」ボタンを素早く2回クリック
  - attemptが1つだけ作成されることを確認

#### 未回答
- [ ] **一部未回答で提出**
  - 問題1: 回答あり
  - 問題2: 未回答（スキップ）
  - 問題3: 回答あり
  - 提出 → エラーにならない
  - result で問題2が不正解として表示

- [ ] **全問未回答で提出**
  - すべての問題をスキップ
  - 提出 → スコア 0点
  - result で全問不正解として表示

#### タイムアップ
- [ ] **時間切れ**
  - 問題1のみ回答して時間切れを待つ
  - 自動提出される
  - result で問題2以降が未回答として記録

---

## QA実施結果記入欄

### 基本フロー
- 複数配信表示: ⬜ 合格 / ⬜ 不合格 (理由:                    )
- 詳細情報表示: ⬜ 合格 / ⬜ 不合格 (理由:                    )
- 受験フロー:   ⬜ 合格 / ⬜ 不合格 (理由:                    )

### 境界条件
- 期限外拒否:     ⬜ 合格 / ⬜ 不合格 (理由:                    )
- attempts上限:   ⬜ 合格 / ⬜ 不合格 (理由:                    )
- override反映:   ⬜ 合格 / ⬜ 不合格 (理由:                    )

### 事故防止
- 二重開始防止:   ⬜ 合格 / ⬜ 不合格 (理由:                    )
- 未回答対応:     ⬜ 合格 / ⬜ 不合格 (理由:                    )
- タイムアップ:   ⬜ 合格 / ⬜ 不合格 (理由:                    )

---

## 修正が必要な項目（優先度順）

### P0（必須 - 動作に影響）
1. ✅ **未回答の扱い実装** - StudentAttemptSubmitView で choice_id=null を許容
2. ⏳ **フロント未回答送信** - choice_id=null を送信するように修正

### P1（推奨 - UX/信頼性）
1. ⏳ **二重開始防止** - ボタンdisable + サーバ側ガード（オプション）
2. ⏳ **タイムアップ動作確認** - 未回答時の挙動テスト

### P2（後回し可）
1. ⏳ **エラーメッセージ改善** - ユーザーフレンドリーなメッセージ
2. ⏳ **ローディング状態改善** - スケルトンスクリーン等
