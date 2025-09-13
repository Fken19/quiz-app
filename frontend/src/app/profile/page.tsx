'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { User } from '@/types/quiz';
import LoadingSpinner from '@/components/LoadingSpinner';

interface InstructorInfo {
  id: string;
  name: string;
  email: string;
  joined_at: string;
}

interface ApprovalHistory {
  id: string;
  instructor_name: string;
  instructor_email: string;
  action: 'approved' | 'removed';
  date: string;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [instructors, setInstructors] = useState<InstructorInfo[]>([]);
  const [approvalHistory, setApprovalHistory] = useState<ApprovalHistory[]>([]);
  
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
      const token = (session as any)?.backendAccessToken;
      if (!token) {
        setError('認証トークンが見つかりません');
        return;
      }

      // プロフィール情報を取得
      const profileRes = await fetch('/api/user/profile/', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        
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
        
      } else {
        const errorData = await profileRes.json();
        setError(errorData.message || 'プロフィール情報の取得に失敗しました');
      }

      // 講師一覧を取得（デモデータ）
      // TODO: 実際のAPI実装時に置き換え
      const demoInstructors: InstructorInfo[] = [
        {
          id: '1',
          name: '田中先生',
          email: 'tanaka@example.com',
          joined_at: '2024-01-15T00:00:00Z'
        },
        {
          id: '2', 
          name: '佐藤先生',
          email: 'sato@example.com',
          joined_at: '2024-02-20T00:00:00Z'
        }
      ];
      setInstructors(demoInstructors);

      // 承認/解除履歴を取得（デモデータ）
      const demoHistory: ApprovalHistory[] = [
        {
          id: '1',
          instructor_name: '田中先生',
          instructor_email: 'tanaka@example.com',
          action: 'approved',
          date: '2024-01-15T00:00:00Z'
        },
        {
          id: '2',
          instructor_name: '山田先生',
          instructor_email: 'yamada@example.com', 
          action: 'removed',
          date: '2024-03-10T00:00:00Z'
        },
        {
          id: '3',
          instructor_name: '佐藤先生',
          instructor_email: 'sato@example.com',
          action: 'approved',
          date: '2024-02-20T00:00:00Z'
        }
      ];
      setApprovalHistory(demoHistory);

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

  const handleRemoveInstructor = async (instructorId: string) => {
    const instructor = instructors.find(i => i.id === instructorId);
    if (!instructor) return;

    const confirmed = window.confirm(
      `${instructor.name}との紐付けを解除しますか？この操作により、講師からの管理対象から外れます。`
    );
    
    if (!confirmed) return;

    try {
      const token = (session as any)?.backendAccessToken;
      if (!token) {
        setError('認証トークンが見つかりません');
        return;
      }

      // TODO: 実際のAPI実装時に置き換え
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 講師一覧から削除
      setInstructors(prev => prev.filter(i => i.id !== instructorId));
      
      // 履歴に追加
      const newHistory: ApprovalHistory = {
        id: Date.now().toString(),
        instructor_name: instructor.name,
        instructor_email: instructor.email,
        action: 'removed',
        date: new Date().toISOString()
      };
      setApprovalHistory(prev => [newHistory, ...prev]);
      
      setSuccess('講師との紐付けを解除しました');

    } catch (err) {
      console.error('Failed to remove instructor:', err);
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
        <h1 className="text-3xl font-bold text-gray-900">プロフィール</h1>
        <p className="mt-2 text-gray-600">
          プロフィール情報と講師との関係を管理できます。
        </p>
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
              <h3 className="text-lg font-semibold text-gray-900">プロフィール編集</h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* アバター画像 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4">
                  アバター画像
                </label>
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
                      className="cursor-pointer bg-white border border-gray-300 rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      画像を変更
                    </label>
                  </div>
                </div>
              </div>

              {/* 表示名 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  表示名
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
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

          {/* 管理中の講師一覧 */}
          <div className="mt-6 bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">管理中の講師一覧</h3>
              <p className="text-sm text-gray-600 mt-1">あなたを管理している講師の一覧です</p>
            </div>
            <div className="p-6">
              {instructors.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">管理中の講師はいません</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {instructors.map((instructor) => (
                    <div key={instructor.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <h4 className="font-medium text-gray-900">{instructor.name}</h4>
                        <p className="text-sm text-gray-600">{instructor.email}</p>
                        <p className="text-xs text-gray-500">
                          紐付け日: {new Date(instructor.joined_at).toLocaleDateString('ja-JP')}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveInstructor(instructor.id)}
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
            <h3 className="text-lg font-semibold text-gray-900 mb-4">統計情報</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">総受験回数</span>
                <span className="font-medium">{user.quiz_count}回</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">平均スコア</span>
                <span className="font-medium">{user.average_score?.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">登録日</span>
                <span className="font-medium">
                  {new Date(user.created_at).toLocaleDateString('ja-JP')}
                </span>
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
                  <h4 className="text-lg font-medium text-gray-900">{user.display_name}</h4>
                  <p className="text-gray-600">{user.email}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 承認/解除履歴 */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">承認/解除履歴</h3>
              <p className="text-sm text-gray-600 mt-1">講師との紐付け履歴</p>
            </div>
            <div className="p-6">
              {approvalHistory.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-gray-500">履歴はありません</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {approvalHistory.slice(0, 5).map((history) => (
                    <div key={history.id} className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        history.action === 'approved' ? 'bg-green-500' : 'bg-red-500'
                      }`}></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {history.instructor_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {history.action === 'approved' ? '承認' : '解除'} - {' '}
                          {new Date(history.date).toLocaleDateString('ja-JP')}
                        </p>
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
