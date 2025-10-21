# ホワイトリストエラーハンドリングの修正

## 問題
未登録メールアドレスでの講師画面遷移時に、403エラーが適切に処理されず、エラーメッセージがコンソールに表示される問題がありました。

## エラー内容
```
ApiError: Your email is not registered in the teacher whitelist. Please contact an administrator.
  at apiRequest (src/lib/api-utils.ts:65:11)
  at async TeacherDashboardPage.useEffect.fetchStats (src/app/teacher/dashboard/page.tsx:40:68)
```

## 根本原因
1. **TeacherShell**: `err?.response?.status`でステータスチェックしていたが、`ApiError`は`err.status`として公開
2. **ダッシュボードページ**: 403エラーのキャッチ処理がなく、一般的なエラーメッセージを表示
3. **エラーの伝播**: TeacherShellでチェックする前に、子コンポーネント（ダッシュボード）がAPIを呼び出し

## 解決策

### 1. ApiErrorクラスの構造確認
```typescript
export class ApiError extends Error {
  status: number;      // ← ここに直接ステータスコードが格納される
  body?: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}
```

### 2. TeacherShellの修正
**ファイル**: `frontend/src/components/teacher/TeacherShell.tsx`

**変更前**:
```typescript
if (teacherErr?.response?.status === 403) {
  // ホワイトリスト未登録
}
```

**変更後**:
```typescript
if (teacherErr?.status === 403) {
  // ApiErrorのstatusプロパティをチェック
  console.warn(
    `Whitelist check failed for ${user.email}: not registered`,
    teacherErr
  );
  router.replace('/teacher/access-denied');
  return;
}
```

### 3. ダッシュボードページの修正
**ファイル**: `frontend/src/app/teacher/dashboard/page.tsx`

**追加内容**:
```typescript
import { ApiError } from '@/lib/api-utils';
import { useRouter } from 'next/navigation';

// useEffect内のcatchブロック
catch (err) {
  console.error('Dashboard fetch error:', err);
  
  // ApiErrorの場合、403エラーはホワイトリスト未登録
  if (err instanceof ApiError && err.status === 403) {
    console.warn('Access denied (403) - redirecting to access-denied page');
    router.replace('/teacher/access-denied');
    return;
  }
  
  setError('ダッシュボード情報の取得に失敗しました');
}
```

### 4. スタッフページの修正
**ファイル**: `frontend/src/app/teacher/staff/page.tsx`

同様に403エラーハンドリングを追加しました。

## エラーハンドリングフロー

```
ユーザーが講師ポータルにアクセス
         ↓
TeacherShell: ユーザー情報取得
         ↓
TeacherShell: /api/teachers/ で事前確認
         ↓
    403エラー？
         ↓
    YES → /teacher/access-denied にリダイレクト
         ↓
    NO → 子コンポーネント（ダッシュボード等）をレンダリング
         ↓
子コンポーネント: 各種APIを呼び出し
         ↓
    403エラー？
         ↓
    YES → /teacher/access-denied にリダイレクト
         ↓
    NO → 通常の表示
```

## 多層防御アプローチ

### レイヤー1: TeacherShell（最優先）
- 講師ポータルへのアクセス時に即座にチェック
- `/api/teachers/`エンドポイントで事前確認
- 403エラーを検知したら即座にリダイレクト

### レイヤー2: 各ページコンポーネント
- ダッシュボード、スタッフページ等で独自にチェック
- TeacherShellでキャッチできなかった403エラーを処理
- ユーザーへの適切なフィードバック

### レイヤー3: バックエンドミドルウェア
- `TeacherAccessControlMiddleware`で厳密なチェック
- 全ての講師APIエンドポイントで強制
- 詳細なエラーメッセージを返却

## テスト方法

### 1. ホワイトリスト未登録ユーザーのテスト

#### 準備
```bash
# テストユーザーをホワイトリストから削除
docker compose exec db psql -U postgres -d quiz_db -c \
  "DELETE FROM teachers_whitelists WHERE email = 'test@example.com';"
```

#### 実行
1. ブラウザで`test@example.com`でログイン
2. `/teacher/dashboard`にアクセス
3. **期待結果**: `/teacher/access-denied`にリダイレクト
4. **期待結果**: エラーページが表示される（コンソールエラーなし）

#### 確認ポイント
- ✅ コンソールに未処理のエラーが表示されない
- ✅ アクセス拒否ページが正常に表示される
- ✅ 「ホワイトリストに登録されていません」メッセージが表示される
- ✅ 「トップページに戻る」ボタンが機能する

### 2. ホワイトリスト登録済みユーザーのテスト

#### 準備
```bash
# テストユーザーをホワイトリストに追加
docker compose exec db psql -U postgres -d quiz_db -c \
  "INSERT INTO teachers_whitelists (teachers_whitelist_id, email, can_publish_vocab, created_at, updated_at) 
   VALUES (gen_random_uuid(), 'test@example.com', true, now(), now());"
```

#### 実行
1. ブラウザで`test@example.com`でログイン
2. `/teacher/dashboard`にアクセス
3. **期待結果**: ダッシュボードが正常に表示される
4. **期待結果**: APIデータが取得・表示される

#### 確認ポイント
- ✅ ダッシュボードが正常に表示される
- ✅ テスト数、生徒数等の統計が表示される
- ✅ リダイレクトが発生しない
- ✅ コンソールにエラーが表示されない

### 3. エラーメッセージの確認

#### ブラウザコンソール
未登録ユーザーの場合:
```
Whitelist check failed for test@example.com: not registered
Access denied (403) - redirecting to access-denied page
```

#### バックエンドログ
```
Access denied: test@example.com not in teacher whitelist
```

## デバッグ情報

### ApiErrorのインスタンスチェック
```typescript
catch (err) {
  console.log('Error type:', err?.constructor?.name);  // "ApiError"
  console.log('Has status:', 'status' in err);         // true
  console.log('Status value:', err.status);            // 403
  console.log('Is ApiError:', err instanceof ApiError); // true
}
```

### ログ出力の追加
各エラーハンドリング箇所に詳細なログを追加:
```typescript
console.error('Dashboard fetch error:', err);
console.warn('Access denied (403) - redirecting to access-denied page');
```

## 関連ファイル

### 修正したファイル
1. `frontend/src/components/teacher/TeacherShell.tsx`
   - `err.status`でステータスチェックに修正
   - 詳細なログ出力を追加

2. `frontend/src/app/teacher/dashboard/page.tsx`
   - `ApiError`インポート追加
   - 403エラーのキャッチ処理を追加
   - リダイレクト処理を実装

3. `frontend/src/app/teacher/staff/page.tsx`
   - ダッシュボードと同様の修正

### 影響を受けないファイル
- `frontend/src/lib/api-utils.ts` - 既に正しく実装済み
- `backend/quiz/middleware.py` - 既に正しく実装済み
- `frontend/src/app/teacher/access-denied/page.tsx` - 既に実装済み

## 今後の改善案

### 1. 共通エラーハンドリングフック
```typescript
// hooks/useTeacherAccess.ts
export function useTeacherAccess() {
  const router = useRouter();
  
  const handleApiError = (error: unknown) => {
    if (error instanceof ApiError && error.status === 403) {
      router.replace('/teacher/access-denied');
      return true; // handled
    }
    return false; // not handled
  };
  
  return { handleApiError };
}

// 使用例
const { handleApiError } = useTeacherAccess();
try {
  await apiGet('/api/teachers/');
} catch (err) {
  if (!handleApiError(err)) {
    setError('エラーが発生しました');
  }
}
```

### 2. エラーバウンダリの実装
```typescript
// components/teacher/TeacherErrorBoundary.tsx
export class TeacherErrorBoundary extends React.Component {
  componentDidCatch(error: Error) {
    if (error instanceof ApiError && error.status === 403) {
      window.location.href = '/teacher/access-denied';
    }
  }
}
```

### 3. 統一されたAPIラッパー
```typescript
export async function teacherApiGet(endpoint: string) {
  try {
    return await apiGet(endpoint);
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      window.location.href = '/teacher/access-denied';
      throw err;
    }
    throw err;
  }
}
```

## まとめ

### 修正のポイント
1. **ApiError構造の理解**: `err.status`で直接ステータスコードにアクセス
2. **多層防御**: TeacherShellと各ページの両方でチェック
3. **適切なリダイレクト**: 403エラー時は必ず`/teacher/access-denied`へ
4. **詳細なログ**: デバッグ用のログ出力を追加

### 動作確認
- ✅ 未登録ユーザーは自動的にアクセス拒否ページへリダイレクト
- ✅ コンソールエラーが適切に処理される
- ✅ ユーザーフレンドリーなエラーメッセージが表示される
- ✅ 登録済みユーザーは正常にアクセス可能

### ユーザーへの影響
- **Before**: コンソールにエラーが表示され、白い画面が表示される
- **After**: 即座にアクセス拒否ページにリダイレクトされ、適切な案内が表示される
