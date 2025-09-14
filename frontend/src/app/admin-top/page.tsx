'use client';

import { useEffect, useState } from 'react';
import { useSession, signIn, getSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import { apiGet } from '@/lib/api-utils';

export default function AdminTop() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isTeacher, setIsTeacher] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 認証状態をチェック
    if (status === 'loading') return;

    if (!session) {
      setLoading(false);
      return;
    }

    checkPermission();
  }, [session, status]);

  const checkPermission = async () => {
    setLoading(true);
    try {
      const data = await apiGet('/auth/check-teacher/');
      if (data.permissions?.can_access_admin) {
        setIsTeacher(true);
        // 講師権限があるなら管理ダッシュボードへ遷移
        router.push('/admin-dashboard');
        return;
      } else {
        setError('このアカウントには講師権限がありません。別のアカウントでログインしてください。');
        setIsTeacher(false);
      }
    } catch (err) {
      console.error('権限チェック失敗', err);
      setError('権限の確認に失敗しました。しばらくしてから再度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  // 未認証
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">講師用ログイン</h2>
            <p className="mt-2 text-center text-sm text-gray-600">講師用の管理画面にログインするには、Googleアカウントでサインインしてください。</p>
          </div>

          <div className="mt-8 space-y-6">
            <div>
              <button
                onClick={() => signIn('google', { callbackUrl: '/admin-top' })}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
              >
                Googleでログイン
              </button>
            </div>

            <div className="text-center text-sm text-gray-600">
              <p>ログイン後、講師権限が確認できれば自動的に管理画面へ移動します。</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 認証済みだが講師ではない
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md mx-auto text-center bg-white p-8 rounded-lg shadow-md">
        <div className="text-yellow-400 text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">講師権限がありません</h1>
        <p className="text-gray-600 mb-6">アカウント: {session.user?.email}</p>
        <p className="text-gray-600 mb-6">このアカウントには講師権限が付与されていません。別のアカウントでログインするか、管理者にホワイトリスト登録を依頼してください。</p>

        <div className="space-y-4">
          <button
            onClick={() => signIn('google', { callbackUrl: '/admin-top' })}
            className="w-full bg-gray-600 text-white px-6 py-3 rounded-md hover:bg-gray-700"
          >
            別のアカウントでログイン
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700"
          >
            生徒ダッシュボードに戻る
          </button>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-yellow-50 rounded-md text-sm text-yellow-800">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
