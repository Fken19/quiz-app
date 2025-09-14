'use client';

import { useEffect, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from './LoadingSpinner';
import { apiGet } from '../lib/api-utils';

interface TeacherGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function TeacherGuard({ children, fallback }: TeacherGuardProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isTeacher, setIsTeacher] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      signIn('google', { callbackUrl: '/admin-top' });
      return;
    }

  checkTeacherPermission();
  }, [session, status]);

  const checkTeacherPermission = async () => {
    try {
      // api-utils の apiGet を使ってバックエンドに問い合わせ（トークン取得を含む）
      const data = await apiGet('/auth/check-teacher/');
      
  if (!data.permissions?.can_access_admin) {
        setError(`このアカウント（${data.email}）には講師権限がありません。ホワイトリストに登録されていない可能性があります。`);
        setIsTeacher(false);
      } else {
        setIsTeacher(true);
      }
    } catch (error) {
      console.error('講師権限チェックエラー:', error);
      setError('権限の確認中にエラーが発生しました。');
      setIsTeacher(false);
    } finally {
      setLoading(false);
    }
  };

  // ローディング中
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className="mt-4 text-gray-600">権限を確認しています...</p>
        </div>
      </div>
    );
  }

  // 未認証
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">認証が必要です</h1>
          <p className="text-gray-600 mb-6">講師機能にアクセスするには、Googleアカウントでログインしてください。</p>
          <button
            onClick={() => signIn('google', { callbackUrl: '/admin-top' })}
            className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700"
          >
            Googleでログイン
          </button>
        </div>
      </div>
    );
  }

  // 講師権限がない
  if (!isTeacher) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="max-w-md mx-auto text-center bg-white p-8 rounded-lg shadow-md">
          <div className="text-red-500 text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">アクセス権限がありません</h1>
          <div className="text-gray-600 mb-6">
            {error || '講師機能にアクセスする権限がありません。'}
          </div>
          <div className="space-y-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700"
            >
              生徒ダッシュボードに戻る
            </button>
            <button
              onClick={() => signIn('google', { callbackUrl: '/admin-top' })}
              className="w-full bg-gray-600 text-white px-6 py-3 rounded-md hover:bg-gray-700"
            >
              別のアカウントでログイン
            </button>
          </div>
          <div className="mt-6 p-4 bg-blue-50 rounded-md text-sm text-blue-800">
            <p className="font-medium mb-2">講師権限が必要な場合：</p>
            <ul className="text-left space-y-1">
              <li>• 管理者にホワイトリストへの追加を依頼</li>
              <li>• 正しいGoogleアカウントでログイン</li>
              <li>• アカウント: {session.user?.email}</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // 講師権限がある場合は子コンポーネントを表示
  return <>{children}</>;
}
