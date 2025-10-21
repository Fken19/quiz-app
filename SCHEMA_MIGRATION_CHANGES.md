# データベーススキーマ修正の変更内容

## 概要
設計書（`docs/quiz_db_design.md`）に合わせてデータベーススキーマを修正しました。
主な変更点は、Django標準の`is_staff`と`is_superuser`フィールドを削除し、
`teachers_whitelists`テーブルによる厳密なアクセス制御に移行したことです。

## 実施日
2025年10月22日

## 変更内容

### 1. データベーススキーマの変更

#### マイグレーション 0005: Staff/Superuserフィールドの削除
- **ファイル**: `backend/quiz/migrations/0005_remove_staff_fields_add_whitelist_enforcement.py`
- **変更内容**:
  - `is_staff=True`または`is_superuser=True`のユーザーを`teachers`テーブルに移行
  - `teachers_whitelists`テーブルに自動登録（`can_publish_vocab=true`）
  - `users`テーブルから`is_staff`フィールドを削除
  - `users`テーブルから`is_superuser`フィールドを削除

#### マイグレーション 0006: PermissionsMixin関連フィールドの削除
- **ファイル**: `backend/quiz/migrations/0006_remove_user_groups_remove_user_user_permissions.py`
- **変更内容**:
  - `users`テーブルから`groups`フィールド（ManyToMany）を削除
  - `users`テーブルから`user_permissions`フィールド（ManyToMany）を削除

### 2. バックエンドコードの変更

#### モデル（`backend/quiz/models.py`）
- **削除**: `PermissionsMixin`の継承を削除
- **追加**: Django管理画面互換メソッドを独自実装
  - `has_perm()`: ホワイトリストベースの権限チェック
  - `has_perms()`: 複数権限チェック
  - `has_module_perms()`: モジュール権限チェック
  - `is_staff`プロパティ: ホワイトリスト登録判定
  - `is_superuser`プロパティ: 常にFalseを返す

#### ビュー（`backend/quiz/views.py`）
- **UserViewSet.get_queryset()**: `is_staff`チェックを`is_teacher_whitelisted()`に変更
- **TeacherProfileViewSet.get_queryset()**: アクセス制御をミドルウェアに委譲
- **StudentTeacherLinkViewSet.get_queryset()**: `is_staff`チェックを`is_teacher_whitelisted()`に変更

#### シリアライザ（`backend/quiz/serializers.py`）
- **UserSerializer**: `is_staff`と`is_superuser`フィールドを削除

#### ミドルウェア（`backend/quiz/middleware.py`）
- **追加**: `TeacherAccessControlMiddleware`
  - 講師APIパス（`/api/teachers/`, `/api/tests/`等）へのアクセス時にホワイトリストチェック
  - ホワイトリスト未登録の場合は403エラーを返却
  - ホワイトリスト登録済みの場合、`Teacher`レコードを自動作成

#### 設定（`backend/quiz_backend/settings.py`）
- **追加**: `TeacherAccessControlMiddleware`をMIDDLEWAREリストに追加

### 3. フロントエンドコードの変更

#### TypeScript型定義（`frontend/src/types/quiz.ts`）
- **ApiUser**: `is_staff`フィールドを削除

#### コンポーネント
- **TeacherShell.tsx**: `is_staff`チェックを削除、403エラーハンドリングに変更
- **teacher/profile/page.tsx**: 権限バッジを「講師（ホワイトリスト登録済み）」に固定
- **teacher/staff/page.tsx**: `is_staff`による条件分岐を削除

### 4. ドキュメントの更新

#### 設計書（`docs/quiz_db_design.md`）
- **users**テーブルの説明に以下を追記:
  - `username`フィールドの保持理由（Django管理画面互換）
  - `is_active`フィールドの保持理由（Django互換）
  - 講師権限の判定方法（`teachers_whitelists`テーブル使用）

#### README（`README.md`）
- **見出し変更**: "管理者向け（is_staff必須）" → "講師向け（ホワイトリスト登録必須）"

## アクセス制御の変更点

### 変更前
- `User`モデルに`is_staff`と`is_superuser`フィールドが存在
- これらのフィールドで講師権限を判定
- フロントエンドでも`is_staff`を参照

### 変更後
- `teachers_whitelists`テーブルが唯一のアクセス制御手段
- ミドルウェアレベルでホワイトリストチェックを強制
- Django管理画面アクセスもホワイトリストベース
- フロントエンドはバックエンドの403エラーに従う

## 権限判定フロー

```
1. ユーザーがOAuth認証成功
2. TeacherAccessControlMiddlewareが講師APIパスをチェック
3. teachers_whitelistsテーブルでメールアドレスを検証
4a. ✅ 登録あり → アクセス許可 + Teacher自動作成
4b. ❌ 登録なし → 403 Forbidden + エラーメッセージ
```

## 既存データの移行

### 移行されたデータ
- `fukuik19@gmail.com`（既存のスーパーユーザー）
  - `teachers`テーブルに追加
  - `teachers_whitelists`に追加（`can_publish_vocab=true`）
  - 注記: "Migrated from superuser/staff (user_id: ...)"

## 互換性維持

### Django管理画面
- `User`モデルに`is_staff`と`is_superuser`をプロパティとして実装
- ホワイトリスト登録済みユーザーは管理画面にアクセス可能
- 未登録ユーザーは管理画面にアクセス不可

### 認証バックエンド
- `AbstractBaseUser`を継承（変更なし）
- `USERNAME_FIELD = "email"`（変更なし）
- OAuth認証フロー（変更なし）

## テスト方法

### 1. 講師ポータルアクセステスト
```bash
# ホワイトリスト登録済みユーザーでログイン
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/teachers/
# 期待結果: 200 OK
```

### 2. 未登録ユーザーのアクセス拒否テスト
```bash
# ホワイトリスト未登録ユーザーでログイン
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/teachers/
# 期待結果: 403 Forbidden
```

### 3. ホワイトリスト確認
```bash
docker compose exec db psql -U postgres -d quiz_db -c "SELECT * FROM teachers_whitelists;"
```

### 4. 自動Teacher作成の確認
```bash
# ホワイトリスト登録済みユーザーで初回アクセス
docker compose exec db psql -U postgres -d quiz_db -c "SELECT * FROM teachers WHERE email='<email>';"
```

## ロールバック手順（緊急時）

もし問題が発生した場合、以下の手順でロールバック可能：

```bash
# マイグレーション0004に戻す（is_staff/is_superuserが存在する状態）
docker compose exec backend python manage.py migrate quiz 0004

# ※注意: この場合、コードの変更も戻す必要があります
git checkout <previous-commit>
docker compose restart backend
```

## 関連ファイル

### マイグレーション
- `backend/quiz/migrations/0005_remove_staff_fields_add_whitelist_enforcement.py`
- `backend/quiz/migrations/0006_remove_user_groups_remove_user_user_permissions.py`

### バックエンド
- `backend/quiz/models.py`
- `backend/quiz/views.py`
- `backend/quiz/serializers.py`
- `backend/quiz/middleware.py`
- `backend/quiz_backend/settings.py`

### フロントエンド
- `frontend/src/types/quiz.ts`
- `frontend/src/components/teacher/TeacherShell.tsx`
- `frontend/src/app/teacher/profile/page.tsx`
- `frontend/src/app/teacher/staff/page.tsx`

### ドキュメント
- `docs/quiz_db_design.md`
- `README.md`

## 検証結果

### ✅ 完了した検証項目
- [x] マイグレーション0005実行成功
- [x] マイグレーション0006実行成功
- [x] usersテーブルからis_staff/is_superuser削除確認
- [x] teachers_whitelistsにデータ登録確認
- [x] バックエンド起動成功
- [x] コンパイルエラーなし
- [x] Django警告（auth.W004）は既知の問題（部分一意制約使用のため）

### ⚠️ 既知の警告
```
quiz.User: (auth.W004) 'User.email' is named as the 'USERNAME_FIELD', but it is not unique.
HINT: Ensure that your authentication backend(s) can handle non-unique usernames.
```
→ これは設計通り。部分一意制約（`WHERE deleted_at IS NULL`）を使用しているため。

## 今後の作業
1. フロントエンドでの動作確認
2. 講師ポータルの各機能テスト
3. ホワイトリスト管理機能のテスト
4. 本番環境へのデプロイ計画
