'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { User } from '@/types/quiz';
import LoadingSpinner from '@/components/LoadingSpinner';
import InviteCodeInput from '@/components/InviteCodeInput';
import { apiGet, apiDelete } from '@/lib/api-utils';

interface TeacherLink {
  id: string;
  teacher: {
    id: string;
    display_name: string;
    email: string;
  };
  student: {
    id: string;
    display_name: string;
    email: string;
  };
  status: 'pending' | 'active' | 'revoked';
  linked_at: string;
  revoked_at?: string;
  revoked_by?: {
    id: string;
    display_name: string;
    email: string;
  };
  invite_code?: {
    id: string;
    code: string;
  };
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [teacherLinks, setTeacherLinks] = useState<TeacherLink[]>([]);
  const [allLinks, setAllLinks] = useState<TeacherLink[]>([]); // 全履歴（active + revoked）
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Normalize avatar URLs returned by backend (replace Docker-internal host)
  const normalizeAvatarUrl = (avatarUrl: string | null | undefined) => {
    if (!avatarUrl) return null;
    try {
      const parsed = new URL(avatarUrl);
      if (parsed.hostname === 'backend') {
        const publicHost = window.location.hostname || 'localhost';
        parsed.hostname = publicHost;
        parsed.port = '8080';
        return parsed.toString();
      }
      return avatarUrl;
    } catch (e) {
      return avatarUrl;
    }
  };

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    fetchUserProfile();
  }, [session, status, router]);

  const fetchUserProfile = async () => {
    try {
      // プロフィール情報を取得
      const profileData = await apiGet('/user/profile/');
      
      // APIレスポンスの構造を確認して適切にデータを設定
      const userData = profileData.user || profileData;
      setUser(userData);
      setDisplayName(userData.display_name || '');
      
      // avatar_url が存在する場合はそれを使用、なければavatarフィールドのURLを使用
      const avatarUrl = userData.avatar_url || (userData.avatar && userData.avatar.startsWith('http') ? userData.avatar : null);
      // Normalize URLs that point to the Docker internal hostname 'backend'
      let normalizedAvatarUrl = avatarUrl;
      if (normalizedAvatarUrl) {
        try {
          const parsed = new URL(normalizedAvatarUrl);
          if (parsed.hostname === 'backend') {
            // replace internal docker hostname with host-accessible origin and port
            const publicHost = window.location.hostname || 'localhost';
            // backend listens on 8080 in docker-compose
            parsed.hostname = publicHost;
            parsed.port = '8080';
            normalizedAvatarUrl = parsed.toString();
          }
        } catch (e) {
          // keep original if URL parsing fails
        }
      }
      setAvatarPreview(normalizedAvatarUrl);

      // 生徒用の講師リンク一覧を取得
      try {
        const linksData = await apiGet('/student/teachers/');
        setTeacherLinks(Array.isArray(linksData) ? linksData : linksData.results || []);
        
        // 全履歴も取得（解除済みを含む）
        const allLinksData = await apiGet('/student/teachers/?include_revoked=true');
        setAllLinks(Array.isArray(allLinksData) ? allLinksData : allLinksData.results || []);
      } catch (linkError) {
        console.warn('講師リンク情報の取得に失敗:', linkError);
        setTeacherLinks([]);
        setAllLinks([]);
      }

    } catch (err) {
      console.error('Failed to fetch user profile:', err);
      setError('プロフィール情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const token = (session as any)?.backendAccessToken;
      if (!token) {
        setError('認証トークンが見つかりません');
        return;
      }

      const formData = new FormData();
      formData.append('display_name', displayName);
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      const res = await fetch('/api/user/profile/', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const response = await res.json();
      
      // APIレスポンスの構造に応じて処理
      if (response.success) {
        setSuccess(response.message || 'プロフィールを更新しました');
        const updatedUser = response.user;

        // Normalize avatar URL if needed
        const normalizedAvatar = normalizeAvatarUrl(updatedUser?.avatar_url || updatedUser?.avatar);

        // ユーザー情報を更新
        if (user && updatedUser) {
          setUser({
            ...user,
            display_name: updatedUser.display_name || displayName,
            avatar_url: normalizedAvatar || user.avatar_url,
          });
        }

        // アバター画像の表示を更新
        if (normalizedAvatar) {
          setAvatarPreview(normalizedAvatar);
        }

        // ファイル選択をリセット
        setAvatarFile(null);

      } else {
        // APIからエラーメッセージが返された場合
        setError(response.message || 'プロフィールの更新に失敗しました');
      }

    } catch (err) {
      console.error('Failed to update profile:', err);
      setError('プロフィールの更新に失敗しました。もう一度お試しください。');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveTeacher = async (linkId: string) => {
    const link = teacherLinks.find(l => l.id === linkId);
    if (!link) return;

    const confirmed = window.confirm(
      `${link.teacher.display_name || link.teacher.email}との紐付けを解除しますか？この操作により、講師からの管理対象から外れます。`
    );
    
    if (!confirmed) return;

    try {
      // 生徒用の講師リンク削除API
      await apiDelete(`/student/teachers/${linkId}/revoke/`);
      
      // 講師一覧から削除（状態更新）
      setTeacherLinks(prev => prev.filter(l => l.id !== linkId));
      
      // 全履歴にrevokedとして追加（再取得するのが理想的だが、簡易的に状態更新）
      const updatedLink = {
        ...link,
        status: 'revoked' as const,
        revoked_at: new Date().toISOString(),
      };
      setAllLinks(prev => [updatedLink, ...prev.filter(l => l.id !== linkId)]);
      
      setSuccess('講師との紐付けを解除しました');

    } catch (err) {
      console.error('Failed to remove teacher link:', err);
      setError('講師との紐付け解除に失敗しました');
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!session || !user) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-3xl font-bold text-black">プロフィール</h1>
        <p className="mt-2 text-black">プロフィール情報と講師との関係を管理できます。</p>
      </div>

      {/* アラート */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">エラー</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">成功</h3>
              <div className="mt-2 text-sm text-green-700">{success}</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* プロフィール編集 */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-black">プロフィール編集</h3>
              </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* アバター画像 */}
              <div>
                <label className="block text-sm font-medium text-black mb-4">アバター画像</label>
                <div className="flex items-center space-x-6">
                  <div className="w-20 h-20 bg-indigo-500 rounded-full flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      user.display_name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                      id="avatar-upload"
                    />
                    <label
                      htmlFor="avatar-upload"
                      className="cursor-pointer bg-white border border-gray-300 rounded-md px-4 py-2 text-sm font-medium text-black hover:bg-gray-50"
                    >
                      画像を変更
                    </label>
                  </div>
                </div>
              </div>

              {/* 表示名 */}
              <div>
                <label className="block text-sm font-medium text-black mb-1">表示名</label>
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-black"
                          required
                        />
              </div>

              {/* 保存ボタン */}
              <div className="pt-6 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full md:w-auto px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {saving ? (
                    <>
                      <LoadingSpinner size="small" />
                      <span className="ml-2">保存中...</span>
                    </>
                  ) : (
                    '変更を保存'
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* 招待コード入力 */}
          <div className="mt-6 bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-black">講師からの招待</h3>
              <p className="text-sm text-black mt-1">講師から受け取った招待コードを入力してください</p>
            </div>
            <div className="p-6">
              <InviteCodeInput 
                onSuccess={(teacherName: string) => {
                  setSuccess(`${teacherName}との紐付けが完了しました`);
                  // データを再取得して最新状態に更新
                  fetchUserProfile();
                }}
                onError={setError}
              />
            </div>
          </div>

          {/* 管理中の講師一覧 */}
          <div className="mt-6 bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-black">管理中の講師一覧</h3>
              <p className="text-sm text-black mt-1">あなたを管理している講師の一覧です</p>
            </div>
            <div className="p-6">
              {teacherLinks.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-black">管理中の講師はいません</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {teacherLinks.map((link) => (
                    <div key={link.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <h4 className="font-medium text-black">{link.teacher.display_name || link.teacher.email}</h4>
                        <p className="text-sm text-black">{link.teacher.email}</p>
                        <p className="text-xs text-black">紐付け日: {new Date(link.linked_at).toLocaleDateString('ja-JP')}</p>
                        {link.invite_code && (
                          <p className="text-xs text-black">コード: {link.invite_code.code}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveTeacher(link.id)}
                        className="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700"
                      >
                        解除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 統計情報＆承認/解除履歴 */}
        <div className="lg:col-span-1 space-y-6">
          {/* 統計情報 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-black mb-4">統計情報</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-black">総受験回数</span>
                        <span className="font-medium text-black">{user.quiz_count}回</span>
              </div>
              <div className="flex justify-between">
                <span className="text-black">平均スコア</span>
                        <span className="font-medium text-black">{user.average_score?.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-black">登録日</span>
                        <span className="font-medium text-black">{new Date(user.created_at).toLocaleDateString('ja-JP')}</span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center">
                <div className="w-16 h-16 bg-indigo-500 rounded-full flex items-center justify-center text-white text-xl font-bold overflow-hidden">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    user.display_name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="ml-4">
                  <h4 className="text-lg font-medium text-black">{user.display_name}</h4>
                  <p className="text-black">{user.email}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 承認/解除履歴 */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-black">承認/解除履歴</h3>
              <p className="text-sm text-black mt-1">講師との紐付け履歴</p>
            </div>
            <div className="p-6">
              {allLinks.length === 0 ? (
                <div className="text-center py-4">
            <p className="text-black">履歴はありません</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allLinks
                    .sort((a, b) => new Date(b.linked_at).getTime() - new Date(a.linked_at).getTime())
                    .slice(0, 5)
                    .map((link) => (
                    <div key={link.id} className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        link.status === 'active' ? 'bg-green-500' : 'bg-red-500'
                      }`}></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-black truncate">{link.teacher.display_name || link.teacher.email}</p>
                        <p className="text-xs text-black">{link.status === 'active' ? '紐付け' : '解除'} - {new Date(link.status === 'active' ? link.linked_at : (link.revoked_at || link.linked_at)).toLocaleDateString('ja-JP')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
