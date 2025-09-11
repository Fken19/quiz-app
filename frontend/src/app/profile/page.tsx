'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { User } from '@/types/quiz';
import LoadingSpinner from '@/components/LoadingSpinner';

interface ProfileFormData {
  display_name: string;
  email: string;
  level_preference: number;
  notification_enabled: boolean;
  auto_advance: boolean;
  dark_mode: boolean;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [user, setUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<ProfileFormData>({
    display_name: '',
    email: '',
    level_preference: 1,
    notification_enabled: true,
    auto_advance: false,
    dark_mode: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      // TODO: 実際のAPIコールに置き換え
      // const userProfile = await getUserProfile();
      
      // デモデータ
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
        display_name: demoUser.display_name,
        email: demoUser.email,
        level_preference: demoUser.level_preference || 1,
        notification_enabled: true,
        auto_advance: false,
        dark_mode: false
      });
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
      setError('プロフィール情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (key: keyof ProfileFormData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // TODO: 実際のAPIコールに置き換え
      // await updateUserProfile(formData);
      
      // デモ用の遅延
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSuccess('プロフィールを更新しました');
      
      // ユーザー情報を更新
      if (user) {
        setUser({
          ...user,
          display_name: formData.display_name,
          email: formData.email,
          level_preference: formData.level_preference
        });
      }
    } catch (err) {
      console.error('Failed to update profile:', err);
      setError('プロフィールの更新に失敗しました');
    } finally {
      setSaving(false);
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
              <div className="flex items-center">
                <div className="w-20 h-20 bg-indigo-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {user.display_name.charAt(0).toUpperCase()}
                </div>
                <div className="ml-4">
                  <h4 className="text-lg font-medium text-gray-900">{user.display_name}</h4>
                  <p className="text-gray-600">{user.email}</p>
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
                      value={formData.display_name}
                      onChange={(e) => handleInputChange('display_name', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      メールアドレス
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* クイズ設定 */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-4">クイズ設定</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    デフォルトレベル
                  </label>
                  <select
                    value={formData.level_preference}
                    onChange={(e) => handleInputChange('level_preference', parseInt(e.target.value))}
                    className="w-full md:w-auto p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value={1}>レベル1（初級）</option>
                    <option value={2}>レベル2（中級）</option>
                    <option value={3}>レベル3（上級）</option>
                    <option value={4}>レベル4（最上級）</option>
                  </select>
                  <p className="mt-1 text-sm text-gray-600">
                    クイズ開始時にデフォルトで選択されるレベルです。
                  </p>
                </div>
              </div>

              {/* アプリ設定 */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-4">アプリ設定</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">通知を有効にする</label>
                      <p className="text-sm text-gray-600">新機能やお知らせの通知を受け取ります</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.notification_enabled}
                      onChange={(e) => handleInputChange('notification_enabled', e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">自動進行</label>
                      <p className="text-sm text-gray-600">回答後に自動的に次の問題に進みます</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.auto_advance}
                      onChange={(e) => handleInputChange('auto_advance', e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </div>

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
