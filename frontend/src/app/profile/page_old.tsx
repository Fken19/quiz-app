'use client';

import { useSession, getSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { User } from '@/types/quiz';
import LoadingSpinner from '@/components/LoadingSpinner';

interface ProfileFormData {
  username: string;
  email: string;
  name: string;
  level: number;
  avatar: File | null;
  dark_mode: boolean;
}

interface Instructor {
  id: string;
  name: string;
  email: string;
  organization: string;
  created_at: string;
}

interface InstructorHistory {
  instructor: Instructor;
  linked_at: string;
  unlinked_at?: string;
  status: 'active' | 'unlinked';
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [user, setUser] = useState<User | null>(null);
    const [formData, setFormData] = useState<ProfileFormData>({
    username: '',
    email: '',
    name: '',
    level: 1,
    avatar: null,
    dark_mode: false
  });
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [instructorHistory, setInstructorHistory] = useState<InstructorHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    fetchUserData();
  }, [session, status, router]);

    const fetchUserData = async () => {
      try {
        const session = await getSession();
        const token = (session as any)?.accessToken;

        if (!token) {
          setError('認証が必要です');
          return;
        }

        // プロフィール情報を取得
      const response = await fetch(`/api/user/profile/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(updatedProfile),
        });        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          const userData = profileData.user || profileData;
          
          setUser(userData);
          setFormData({
            username: userData.email || userData.auth_id || '',
            email: userData.email || '',
            name: userData.display_name || '',
            level: userData.level_preference || 1,
            avatar: null,
            dark_mode: false
          });
        } else {
          // デモデータ使用
          const demoUser: User = {
            id: 'user1',
            auth_id: session?.user?.email || '',
            email: session?.user?.email || '',
            display_name: session?.user?.name || '',
            role: 'student',
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString(),
            level_preference: 2,
            quiz_count: 15,
            total_score: 68,
            average_score: 75.5
          };

          setUser(demoUser);
          setFormData({
            username: demoUser.auth_id || demoUser.email,
            email: demoUser.email,
            name: demoUser.display_name,
            level: demoUser.level_preference || 1,
            avatar: null,
            dark_mode: false
          });
        }

        // 管理中の講師一覧を取得
        await fetchInstructors(token);
      } catch (err) {
        console.error('データ取得エラー:', err);
        setError('データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };  const fetchInstructors = async (token: string) => {
    try {
      const response = await fetch('/api/user/instructors', {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setInstructors(data.active || []);
        setInstructorHistory(data.history || []);
      } else {
        // デモデータ
        const demoInstructors: Instructor[] = [];
        const demoHistory: InstructorHistory[] = [];
        setInstructors(demoInstructors);
        setInstructorHistory(demoHistory);
      }
    } catch (err) {
      console.error('Failed to fetch instructors:', err);
      // エラーは無視（講師情報は必須ではない）
    }
  };

  const handleInputChange = (key: keyof ProfileFormData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setError(null);
    setSuccess(null);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ファイルサイズチェック（5MB以下）
    if (file.size > 5 * 1024 * 1024) {
      setError('画像ファイルのサイズは5MB以下にしてください');
      return;
    }

    // ファイル形式チェック
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('JPEG、PNG、GIF、WebP形式の画像ファイルを選択してください');
      return;
    }

    setFormData(prev => ({ ...prev, avatar: file }));
    
    // プレビュー画像を作成
    const reader = new FileReader();
    reader.onload = (e) => {
      setAvatarPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    
    setError(null);
    setSuccess(null);
  };

  const removeAvatar = () => {
    setFormData(prev => ({ ...prev, avatar: null }));
    setAvatarPreview(null);
    // ファイル入力をリセット
    const fileInput = document.getElementById('avatar-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const session = await getSession();
      const token = (session as any)?.accessToken;
      if (!token) {
        setError('認証トークンが見つかりません');
        return;
      }

      // FormDataを使用してファイルと一緒に送信
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('level', formData.level.toString());
      formDataToSend.append('dark_mode', formData.dark_mode.toString());
      
      if (formData.avatar) {
        formDataToSend.append('avatar', formData.avatar);
      }

      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Token ${token}`,
        },
        body: formDataToSend,
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setSuccess('プロフィールを正常に更新しました');
        
        // ユーザー情報を更新
        if (updatedUser.user) {
          setUser({
            ...user,
            ...updatedUser.user
          });
        }

        // アバターのプレビューをリセット
        if (formData.avatar) {
          setAvatarPreview(null);
          setFormData(prev => ({ ...prev, avatar: null }));
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'プロフィール更新に失敗しました');
      }
    } catch (err) {
      console.error('プロフィール更新エラー:', err);
      setError(err instanceof Error ? err.message : 'プロフィール更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };
      }
    } catch (err) {
      console.error('Failed to update profile:', err);
      setError('プロフィールの更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleUnlinkInstructor = async (instructorId: string) => {
    try {
      const token = session?.backendAccessToken;
      if (!token) {
        setError('認証トークンが見つかりません');
        return;
      }

      const response = await fetch(`/api/user/instructors/${instructorId}/remove/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });      if (response.ok) {
        setSuccess('講師との紐付けを解除しました');
        await fetchInstructors(token);
      } else {
        throw new Error('紐付け解除に失敗しました');
      }
    } catch (err) {
      console.error('Failed to unlink instructor:', err);
      setError('講師との紐付け解除に失敗しました');
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'アカウントを削除すると、すべての履歴とデータが永久に失われます。本当に削除しますか？'
    );
    
    if (!confirmed) return;

    const secondConfirm = window.confirm(
      '最終確認：この操作は取り消せません。アカウントを削除しますか？'
    );
    
    if (!secondConfirm) return;

    try {
      // TODO: 実際のAPIコールに置き換え
      // await deleteUserAccount();
      
      // デモ用の遅延
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // サインアウトしてホームに戻る
      router.push('/auth/signin');
    } catch (err) {
      console.error('Failed to delete account:', err);
      setError('アカウントの削除に失敗しました');
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
          アカウント情報と設定を管理できます。
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
        {/* 統計情報 */}
        <div className="lg:col-span-1">
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
                <span className="text-gray-600">総問題数</span>
                <span className="font-medium">{user.total_score}問正解</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">登録日</span>
                <span className="font-medium">
                  {new Date(user.created_at).toLocaleDateString('ja-JP')}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">最終ログイン</span>
                <span className="font-medium">
                  {new Date(user.last_login!).toLocaleDateString('ja-JP')}
                </span>
              </div>
            </div>

            {/* プロフィール画像 */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="text-md font-medium text-gray-900 mb-4">プロフィール画像</h4>
              <div className="flex items-center space-x-6">
                <div className="w-20 h-20 bg-indigo-500 rounded-full flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
                  {avatarPreview ? (
                    <img 
                      src={avatarPreview} 
                      alt="プロフィール画像プレビュー" 
                      className="w-full h-full object-cover"
                    />
                  ) : user?.avatar_url ? (
                    <img 
                      src={user.avatar_url} 
                      alt="プロフィール画像" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    user.display_name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-4">
                    <label className="cursor-pointer bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm">
                      画像を選択
                      <input
                        id="avatar-input"
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                    </label>
                    {(avatarPreview || user?.avatar_url) && (
                      <button
                        type="button"
                        onClick={removeAvatar}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 text-sm"
                      >
                        削除
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    JPEG、PNG、GIF、WebP形式、5MB以下
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* プロフィール設定 */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">プロフィール設定</h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* 基本情報 */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-4">基本情報</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      表示名
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      メールアドレス
                    </label>
                    <div className="w-full p-3 border border-gray-200 rounded-md bg-gray-50 text-gray-600">
                      {user.email}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      メールアドレスはGoogleアカウントに紐付けられているため変更できません。
                    </p>
                  </div>
                </div>
              </div>

              {/* アバター画像設定 */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-4">アバター画像</h4>
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative">
                    <div className="w-24 h-24 bg-gray-300 rounded-full flex items-center justify-center overflow-hidden">
                      {avatarPreview ? (
                        <img
                          src={avatarPreview}
                          alt="Avatar Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : formData.name ? (
                        <span className="text-gray-600 text-2xl font-bold">
                          {formData.name.charAt(0).toUpperCase()}
                        </span>
                      ) : (
                        <span className="text-gray-500 text-xs">画像なし</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2">
                    <label className="cursor-pointer bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors">
                      画像を選択
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                        capture="environment"
                      />
                    </label>
                    
                    {(avatarPreview || formData.avatar) && (
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarPreview(null);
                          setFormData(prev => ({ ...prev, avatar: null }));
                        }}
                        className="bg-gray-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-600 transition-colors"
                      >
                        削除
                      </button>
                    )}
                  </div>
                  
                  <p className="text-xs text-gray-600 text-center">
                    JPEG, PNG, GIF, WebP対応 (最大5MB)
                  </p>
                </div>
              </div>

              {/* アプリ設定 */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-4">アプリ設定</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">ダークモード</label>
                      <p className="text-sm text-gray-600">アプリの配色を暗いテーマにします</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.dark_mode}
                      onChange={(e) => handleInputChange('dark_mode', e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </div>
                </div>
              </div>

              {/* 管理中の講師 */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-4">管理中の講師</h4>
                {instructors.length === 0 ? (
                  <p className="text-gray-600">現在、紐付けされている講師はいません。</p>
                ) : (
                  <div className="space-y-3">
                    {instructors.map((instructor) => (
                      <div key={instructor.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-md">
                        <div>
                          <h5 className="font-medium text-gray-900">{instructor.name}</h5>
                          <p className="text-sm text-gray-600">{instructor.email}</p>
                          <p className="text-xs text-gray-500">{instructor.organization}</p>
                        </div>
                        <button
                          onClick={() => handleUnlinkInstructor(instructor.id)}
                          className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                        >
                          紐付け解除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 承認/解除履歴 */}
              {instructorHistory.length > 0 && (
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-4">承認/解除履歴</h4>
                  <div className="space-y-2">
                    {instructorHistory.map((history, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{history.instructor.name}</p>
                          <p className="text-xs text-gray-600">
                            {history.status === 'active' 
                              ? `承認日: ${new Date(history.linked_at).toLocaleDateString('ja-JP')}`
                              : `解除日: ${new Date(history.unlinked_at!).toLocaleDateString('ja-JP')}`
                            }
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs ${
                          history.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {history.status === 'active' ? 'アクティブ' : '解除済み'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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

          {/* 危険な操作 */}
          <div className="mt-6 bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-red-900">危険な操作</h3>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-md font-medium text-red-900">アカウントを削除</h4>
                  <p className="text-sm text-red-700 mt-1">
                    アカウントとすべての関連データを永久に削除します。この操作は取り消せません。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                >
                  削除
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
