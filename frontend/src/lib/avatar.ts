// 小ユーティリティ: バックエンドから返る avatar_url をフロントで使えるように正規化し、キャッシュバストを付与
export function normalizeAvatarUrl(avatarUrl?: string | null): string | null {
  if (!avatarUrl) return null;
  try {
    const parsed = new URL(avatarUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080');
    if (parsed.hostname === 'backend') {
      // Docker 内部ホスト名をローカルに合わせる
      if (typeof window !== 'undefined') {
        parsed.hostname = window.location.hostname || 'localhost';
      } else {
        parsed.hostname = 'localhost';
      }
      parsed.port = '8080';
    }
    parsed.searchParams.set('t', String(Date.now()));
    return parsed.toString();
  } catch (_) {
    // 失敗時は単純にキャッシュバストクエリを付与
    const sep = avatarUrl.includes('?') ? '&' : '?';
    return avatarUrl + sep + 't=' + Date.now();
  }
}
