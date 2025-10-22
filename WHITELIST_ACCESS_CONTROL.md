# ホワイトリストアクセス制御の実装

## 概要
講師ポータルへのアクセス制御をホワイトリストベースに厳格化しました。
ホワイトリストの管理は管理者のみが行え、講師は閲覧・変更できません。

## 実施日
2025年10月22日

## 主な変更内容

### 1. ホワイトリスト管理の制限

#### バックエンド
- **TeacherWhitelistViewSet**: `permissions.IsAdminUser`に設定済み
  - 一般の講師からはアクセス不可
  - Django管理画面(`/admin/`)からのみ管理可能

#### フロントエンド
- **ナビゲーションメニュー**: ホワイトリストメニューを削除
  - `frontend/src/components/teacher/TeacherNavigation.tsx`から削除
- **ホワイトリストページ**: 管理者専用メッセージに変更
  - `/teacher/whitelist`にアクセスすると案内ページを表示
  - Django管理画面へのアクセス方法を説明

### 2. OAuth認証後のホワイトリストチェック

#### 認証フロー
```
1. ユーザーがGoogle OAuth認証
   ↓
2. NextAuth経由でDjangoバックエンドと握手
   ↓
3. 講師ポータル(/teacher/*)にアクセス
   ↓
4. TeacherShellでホワイトリスト事前確認
   - /api/teachers/にGETリクエスト
   ↓
5. TeacherAccessControlMiddlewareで厳密チェック
   - ホワイトリスト登録確認
   - 未登録の場合は403エラー
   ↓
6a. ✅ 登録あり → 講師ポータル表示
6b. ❌ 登録なし → /teacher/access-deniedにリダイレクト
```

#### TeacherShell強化
- **ファイル**: `frontend/src/components/teacher/TeacherShell.tsx`
- **変更内容**:
  - 認証成功後、`/api/teachers/`にアクセスしてホワイトリスト確認
  - 403エラーを検知したら`/teacher/access-denied`にリダイレクト
  - エラーログを出力（デバッグ用）

#### ミドルウェアチェック
- **ファイル**: `backend/quiz/middleware.py`
- **TeacherAccessControlMiddleware**:
  - 講師APIパスへのアクセス時にホワイトリスト確認
  - 未登録の場合は詳細なエラーメッセージを返却
  ```json
  {
    "error": "Teacher access denied",
    "detail": "Your email is not registered in the teacher whitelist. Please contact an administrator."
  }
  ```

### 3. アクセス拒否ページの改善

#### 新しいアクセス拒否ページ
- **ファイル**: `frontend/src/app/teacher/access-denied/page.tsx`
- **デザイン**: 完全にリニューアル
  - 警告アイコン表示
  - わかりやすいメッセージ
  - 管理者への問い合わせ案内
  - アクションボタン配置

#### 表示内容
- **タイトル**: "ホワイトリストに登録されていません"
- **説明**: メールアドレスが未登録であることを通知
- **案内**: 管理者への問い合わせ方法
- **アクション**:
  - 「トップページに戻る」ボタン（`/`にリダイレクト）
  - 「ログアウト」ボタン（`/auth/signout`にリダイレクト）
- **ノート**: 別アカウントでのログイン手順

### 4. ホワイトリスト管理ページの変更

#### 新しいホワイトリストページ
- **ファイル**: `frontend/src/app/teacher/whitelist/page.tsx`
- **内容**: 管理者専用案内ページ
  - ロックアイコン表示
  - "管理者専用機能"の明示
  - Django管理画面へのアクセス方法説明
  - 管理手順の表示

#### 表示内容
```
1. Django管理画面にアクセス
2. 「Teacher whitelists」セクションを選択
3. メールアドレスを追加・編集・削除

Django管理画面URL: /admin/
```

## アクセス制御マトリックス

| 機能 | 一般講師 | 管理者 | 生徒 |
|------|---------|--------|------|
| ホワイトリスト閲覧 | ❌ | ✅ | ❌ |
| ホワイトリスト追加 | ❌ | ✅ | ❌ |
| ホワイトリスト編集 | ❌ | ✅ | ❌ |
| ホワイトリスト削除 | ❌ | ✅ | ❌ |
| 講師ポータル利用 | ✅* | ✅ | ❌ |

*ホワイトリスト登録が必要

## Django管理画面でのホワイトリスト管理

### アクセス方法
1. ブラウザで`/admin/`にアクセス
2. 管理者アカウントでログイン
3. 「Quiz」セクションの「Teacher whitelists」をクリック

### 新規講師の追加
1. 「ADD TEACHER WHITELIST」ボタンをクリック
2. 以下の情報を入力:
   - **Email**: 講師のメールアドレス（必須）
   - **Can publish vocab**: 語彙公開権限（チェックボックス）
   - **Note**: メモ（任意）
3. 「SAVE」ボタンをクリック

### 既存講師の編集
1. 対象の講師メールアドレスをクリック
2. 情報を編集
3. 「SAVE」ボタンをクリック

### 講師の削除（アクセス取り消し）
1. 対象の講師メールアドレスをクリック
2. 「Revoked at」に現在日時を設定
3. 「SAVE」ボタンをクリック

または

1. 対象の講師を選択
2. 「Delete selected teacher whitelists」アクションを選択
3. 「Go」ボタンをクリック
4. 確認画面で「Yes, I'm sure」をクリック

## セキュリティ考慮事項

### なぜ講師から管理できないのか
1. **セキュリティリスク軽減**: 講師が他の講師を追加/削除できると権限昇格のリスク
2. **監査証跡の確保**: 管理者のみが変更することで変更履歴が明確に
3. **承認プロセス**: 新規講師の追加には管理者の承認が必要
4. **誤操作防止**: 意図しない削除や変更を防止

### バックエンドでの多層防御
1. **ミドルウェアレベル**: `TeacherAccessControlMiddleware`
   - 講師APIへのすべてのアクセスをチェック
   - ホワイトリスト未登録は即座に403エラー
2. **ViewSetレベル**: `permissions.IsAdminUser`
   - ホワイトリストAPI自体に管理者権限が必要
3. **プロパティレベル**: `User.is_staff`プロパティ
   - ホワイトリスト登録状態を返す

### フロントエンドでの事前確認
1. **TeacherShell**: 講師ポータル表示前にホワイトリスト確認
2. **早期リダイレクト**: 未登録の場合は即座にアクセス拒否ページへ
3. **ユーザーフレンドリー**: わかりやすいエラーメッセージと案内

## テスト方法

### 1. ホワイトリスト未登録ユーザーのテスト
```bash
# 1. テストユーザーを作成（ホワイトリストには追加しない）
docker compose exec backend python manage.py shell
>>> from django.contrib.auth import get_user_model
>>> User = get_user_model()
>>> user = User.objects.create_user(
...     email='test@example.com',
...     oauth_provider='google',
...     oauth_sub='test_sub'
... )
>>> exit()

# 2. フロントエンドで test@example.com でログイン
# 3. /teacher/dashboard にアクセス
# 期待結果: /teacher/access-denied にリダイレクト
```

### 2. ホワイトリスト登録済みユーザーのテスト
```bash
# 1. Django管理画面でホワイトリストに追加
# /admin/ → Teacher whitelists → Add

# 2. フロントエンドで登録したメールアドレスでログイン
# 3. /teacher/dashboard にアクセス
# 期待結果: ダッシュボードが正常に表示される
```

### 3. ホワイトリストページのアクセステスト
```bash
# 1. 講師ユーザーでログイン
# 2. /teacher/whitelist にアクセス
# 期待結果: 管理者専用案内ページが表示される
# 期待結果: ホワイトリストデータは表示されない
```

### 4. API直接アクセステスト
```bash
# ホワイトリスト未登録ユーザーのトークンで
curl -H "Authorization: Bearer <token>" \
     http://localhost:8000/api/teachers/

# 期待結果: 403 Forbidden
# {
#   "error": "Teacher access denied",
#   "detail": "Your email is not registered in the teacher whitelist. Please contact an administrator."
# }
```

## ユーザーへの案内

### 新規講師の登録を希望する場合
1. システム管理者に以下の情報を提供:
   - 氏名
   - メールアドレス（Googleアカウント）
   - 所属（任意）
2. 管理者による登録完了後、メールで通知
3. Googleアカウントでログイン
4. 講師ポータル（`/teacher/dashboard`）にアクセス

### ログイン時にアクセス拒否された場合
1. 使用しているメールアドレスを確認
2. ホワイトリストに登録されているか管理者に確認
3. 未登録の場合は登録を依頼
4. 別のGoogleアカウントを使用している場合は、一度ログアウトして正しいアカウントでログイン

## 関連ファイル

### バックエンド
- `backend/quiz/views.py` - `TeacherWhitelistViewSet`
- `backend/quiz/middleware.py` - `TeacherAccessControlMiddleware`
- `backend/quiz/models.py` - `User.is_staff`プロパティ
- `backend/quiz/utils.py` - `is_teacher_whitelisted()`関数

### フロントエンド
- `frontend/src/components/teacher/TeacherShell.tsx` - 事前ホワイトリストチェック
- `frontend/src/components/teacher/TeacherNavigation.tsx` - ナビゲーションメニュー
- `frontend/src/app/teacher/access-denied/page.tsx` - アクセス拒否ページ
- `frontend/src/app/teacher/whitelist/page.tsx` - 管理者案内ページ

### ドキュメント
- `SCHEMA_MIGRATION_CHANGES.md` - スキーマ変更の詳細
- `docs/quiz_db_design.md` - データベース設計書

## トラブルシューティング

### 問題: 講師がアクセス拒否される
**原因**: ホワイトリスト未登録
**解決策**:
1. Django管理画面でホワイトリストを確認
2. 未登録の場合は追加
3. 登録済みの場合は`revoked_at`がnullか確認

### 問題: 管理者でもホワイトリストにアクセスできない
**原因**: `User.is_staff`プロパティがホワイトリストベースになったため
**解決策**:
1. 管理者のメールアドレスがホワイトリストに登録されているか確認
2. 未登録の場合はデータベースで直接追加:
```sql
INSERT INTO teachers_whitelists (id, email, can_publish_vocab, created_at, updated_at)
VALUES (gen_random_uuid(), 'admin@example.com', true, now(), now());
```

### 問題: アクセス拒否ページが表示されない
**原因**: フロントエンドのルーティング問題
**解決策**:
1. ブラウザのコンソールでエラーを確認
2. `/teacher/access-denied`が`PUBLIC_PATHS`に含まれているか確認
3. フロントエンドを再起動: `docker compose restart frontend`

## 今後の拡張案

### 1. 自動承認フロー
- 講師が自分で登録申請
- 管理者がメールで承認/拒否
- 承認後にホワイトリストに自動追加

### 2. 期限付きアクセス
- `valid_until`フィールドを追加
- 有効期限切れのユーザーを自動的に無効化

### 3. ロールベースの権限
- `can_publish_vocab`以外の細かい権限設定
- 講師レベル（初級/中級/上級）の導入

### 4. 監査ログ
- ホワイトリスト変更履歴の記録
- 誰がいつ変更したかを追跡
