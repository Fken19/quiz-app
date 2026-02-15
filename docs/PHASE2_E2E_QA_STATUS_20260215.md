# Phase 2 統合E2E QA 現状整理・修正ログ・残課題（2026-02-15）

## 1. 目的（この文書のスコープ）

Phase 2 統合E2E QA（講師→配信A/B→学生受験→講師結果/CSV→DB整合性）の実行に向けて、以下を整理する。

- 動く/動かないの切り分け
- 500/404 等の原因と修正内容
- 重要なブロッカー（特に A/B 分離）と設計上の宿題
- UI導線を固定するための次アクション
- セキュリティ（メール直書き等）と運用の止血

---

## 2. 現状アーキテクチャ（確定版）

### 2.1 通信経路（推奨）

- ブラウザ → **Next.js (localhost:3000)** のみにアクセス
- Next.js の `/api/*` → **Django backend (backend:8080)** へ **サーバーサイドでプロキシ**
- フロントコードは **`/api/...` の相対URL**で統一（直で `localhost:8080` を叩かない）

### 2.2 Django側

- backend は **8080** で提供（以前の 8000 前提は破棄）
- 認証は Token を使っている（フロントがどのヘッダ形式を使うかは統一が必要）

### 2.3 通信原則（確定）

- Browser は **必ず** `http://localhost:3000/api/*` を呼ぶ（Same-Origin固定）
- `http://localhost:8080/api/*` の直叩きは curl 等のローカル検証用途のみ
- 画面実装で 8080 を直接参照するコードは不具合要因として禁止

### 2.4 Proxy要件（確定）

- Next Route Handler は upstream へ `cookie` を転送する（セッション認証維持のため必須）
- `authorization` / `content-type` も引き継ぐ
- 末尾スラッシュはフロント側で統一し、308/301 リダイレクトを最小化する

---

## 3. これまでの主な障害と「確定原因」

### 3.1 backend が起動していなかった

- **原因**: `python-dateutil` 不足 → `ModuleNotFoundError: dateutil`
- **対応**: `backend/requirements.txt` に `python-dateutil>=2.8.2` を追加して再ビルド

### 3.2 teacher ログイン後に 500（Teacher参照）

- **原因**: `Teacher` モデルが `user` FK を持たず、**emailで識別**する設計
  → `teacher__user=user` / `Teacher.objects.get(user=...)` が破綻
- **対応**: `views.py` 内の teacher 判定を **`teacher__email=user.email` / `Teacher.objects.get(email=user.email)`** に統一

### 3.3 Next.js → backend 接続が不安定 / Failed to fetch

- **原因**: フロントが `API_BASE_URL` を直接叩く構造、Docker内/外の解決差異
- **対応**:
  - Next.js に `/api/*` プロキシルートを追加（汎用 `[...path]` など）
  - フロントは `/api/...` へ統一

### 3.4 `/teacher/test-assignments/:id/results` で Not Found / 500

- **実際に叩かれていた**: `GET /api/teacher/test-assignments/{assignmentId}/results`（および `results.csv`）
- **原因（複合）**:
  1. `student__name` / `student.name` 参照（`User`側に存在しない）
  2. CSV側で `HttpResponse` 未 import
  3. `run_params` の読み取りが旧スキーマ想定（`available_from` 等）
- **対応**:
  - `student__email` ベースに修正、表示名は `profile.display_name` 優先→なければ email
  - `HttpResponse` import 追加
  - `run_params` を `schedule.start_at / end_at` + `attempts.default_max_attempts` ベースで解釈
  - `remaining_attempts` の優先順位を整理（assignee > assignment default > test default）

---

## 4. 動作確認（現時点の到達点）

### 4.1 teacher results API

- `GET /api/teacher/test-assignments/{id}/results` → **200**
- `GET /api/teacher/test-assignments/{id}/results.csv` → **200**
- Next プロキシ経由でも同等に 200

### 4.2 `run_params` のセット

- assignment の `run_params` を `schedule/timer/attempts` を含む形に更新済み（UI/ロジックが読める形式）

---

## 5. 重要ブロッカー：A/B 分離が「DB制約で再現不能」

### 5.1 問題

現状の DB 制約で `test_assignees` が **(test, student) 一意**になっている場合、
**同一Testで A/B 両配信に同一学生を同時割当できない**。

これがある限り、テンプレートで想定している

> 「同一 test で配信A/Bを作り、同じ学生5人を両方に割り当てて、attempts 独立性を見る」
> が **構造上できない**。

### 5.2 影響

- Phase 2 の P0（assignment単位の独立性）を、**同一Testで**検証できない
- DB直seedで無理やり作ろうとすると、整合性が崩れる（= キメラ化の温床）

### 5.3 対応方針（選択肢）

**A) 最短ワークアラウンド（今日QAを進めたい）**

- 配信A/B用に **Test自体を2つ作る（テスト内容は同じ）**
- A/B独立性は “assignment単位” としては見れるが、厳密には「同一test」ではない

**B) 正攻法（テンプレ通りに検証できる）**

- `TestAssignee` の一意制約を **(test_assignment, student)**（または (test_assignment, test, student)）に変更
- それに伴い、集計・結果APIの母集団の作り方を **assignment単位に統一**
- migration が必要（これが本来の設計）

> Phase2 を「仕様として」成立させるなら **B** が必須。ここが最重要の設計課題。

---

## 6. UI導線の宿題（いま“進めない”根本）

### 6.1 事象

- `/teacher/tests` の一覧行がクリックできない / 画面遷移できない

### 6.2 ありがちな原因（優先度順）

- テーブル行に `onClick` / `Link` が実装されていない（ただ表示しているだけ）
- 行全体ではなく、ボタン/リンクにのみ遷移が付いている（UI上わかりにくい）
- overlay（透明div）や `pointer-events` によってクリックが阻害されている
- `router.push` 先のURLが存在しない/誤っている

### 6.3 UI固定（Phase 2 最小導線）

この3ページが通れば E2E QA が成立する：

1. `/teacher/tests`（一覧）
   - 行内に「詳細」ボタン or 行クリックで `/teacher/tests/[testId]`
2. `/teacher/tests/[testId]`（詳細）
   - 「配信一覧」「配信作成」「割当」への導線
3. `/teacher/test-assignments/[assignmentId]/results`（結果/CSV）
   - 未受験者が出る、CSV出る、A/B混ざらない（ここがP0）

> **UIを先に仕様として固定し、seed/debugは“UIを通す補助”だけにする。**

---

## 7. セキュリティ/運用上の止血（必須）

### 7.1 直書きメール混入

- `fukuik19@gmail.com` がコード/スクリプトに直書きされ、コミットに混ざる構造はNG
- seed/debug は必ず **環境変数**で注入する

推奨：

- `QA_SEED_TEACHER_EMAIL=teacher@example.com`
- `QA_SEED_STUDENTS=student1@example.com,student2@example.com,...`

### 7.2 debug API の扱い

- `/api/debug/*` は **DEBUG時のみ有効**
- 本番/CI で動かないようにする（ルーティング or permission で遮断）

### 7.3 トークン/秘密情報

- Tokenをログに出す・ファイルに残すのは禁止（ローカルでも）
- `.env*` は Git 管理から除外（必要なら `.env.example` のみ）

---

## 8. “忘れている可能性が高い”チェック項目（再発防止）

- **URL末尾 `/` 問題**（Django `APPEND_SLASH` と Next の 308 リダイレクト）
  - API呼び出しは末尾統一（推奨：Djangoは `/` 付き、フロントもそれに合わせる）
- **Browserからの8080直叩き再発防止**
  - `src/lib/api-utils.ts` でブラウザ時は常に相対URL（`/api/*`）を返す
  - `NEXT_PUBLIC_API_*` の値に依存してブラウザが8080へ行かないことを保証する
- **ProxyのCookie転送**
  - `/api/[...path]` で `cookie` を落とさない
  - `authorization` だけに依存しない（Cookieベース認証でも動く状態を維持）
- **認証ヘッダ形式の統一**
  - `Authorization: Token <key>` なのか `Bearer <key>` なのか、どちらで統一しているかをコードで固定
- **assignment の run_params スキーマ**
  - 旧キー (`available_from`) が混ざると結果APIやUIが壊れる
  - `schedule.start_at/end_at` を source-of-truth にする
- **未受験者母集団**
  - results は `TestAssignee` を母集団にして “resultが無い人も出す”
  - ここがズレると Phase2.2 のP0が崩れる

---

## 9. 次のアクション（推奨ロードマップ）

### 9.1 まずUI（最短で“QAが回る状態”へ）

1. `/teacher/tests` の行クリック/詳細ボタンを実装（遷移できる状態）
2. テスト詳細ページで「配信作成」→ assignment が UI で増える
3. assignment詳細 or results への導線をUIに配置

### 9.2 次に A/B 分離（仕様を成立させる）

- `TestAssignee` の一意制約を設計通りに修正（migration）
- results集計も assignment単位に統一
- これが終わるとテンプレ通りに P0（A/B独立性）が検証可能

### 9.3 最後に seed/debug を“安全に”整理

- ハードコード排除、env化
- debug route を DEBUG 限定
- seed は `make seed-e2e` のように一本化

---

## 10. 付録：最小の動作確認コマンド

- results JSON：

```bash
curl -i "http://localhost:8080/api/teacher/test-assignments/<ASSIGNMENT_ID>/results" \
  -H "Authorization: <YOUR_AUTH_HEADER>"
```

- results CSV：

```bash
curl -i "http://localhost:8080/api/teacher/test-assignments/<ASSIGNMENT_ID>/results.csv" \
  -H "Authorization: <YOUR_AUTH_HEADER>"
```

- Nextプロキシ経由：

```bash
curl -i "http://localhost:3000/api/teacher/test-assignments/<ASSIGNMENT_ID>/results" \
  -H "Authorization: <YOUR_AUTH_HEADER>"
```

---

## 結論：これで「いいか？」

**“結果APIが通った”という意味では前進していてOK**。ただし、Phase 2 統合E2E QAをテンプレ通りに完走するには

1. **UI導線（一覧→詳細→配信→結果）を固定**
2. **A/B 分離ブロッカー（TestAssignee一意制約）を解消**
3. **メール直書き/デバッグ混入の止血**

この3点は必須です。いまのままだと「動くけど毎回キメラ化」しやすいです。

---

## こちらからの提案（次の返答で“実装指示書”に落とす）

次のターンで、方針に合わせて、

- **(A)** UI導線の最小仕様（ページ/ボタン/遷移/表示項目）
- **(B)** そのUIに必要なAPI一覧（確定URL）
- **(C)** A/B分離の migration 方針（最小差分）
- **(D)** seed/debug の安全化（env・DEBUGガード）

を **チェックリスト形式**で作成する（そのままタスク化可能）。
