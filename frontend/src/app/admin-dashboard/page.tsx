'use client';

import { useSession, signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import AdminLayout from '@/components/AdminLayout';

interface AdminStats {
  total_students: number;
  total_groups: number;
  active_sessions_today: number;
  average_score: number;
}

interface Group {
  id: string;
  name: string;
  description: string;
  student_count: number;
  created_at: string;
  created_by: string;
}

export default function AdminDashboardHome() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStats>({
    total_students: 0,
    total_groups: 0,
    active_sessions_today: 0,
    average_score: 0
  });
  const [recentGroups, setRecentGroups] = useState<Group[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      fetchAdminData();
    } else if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [status]);

  const fetchAdminData = async () => {
    try {
      // デモデータ（実際のAPIと置き換え予定）
      setStats({
        total_students: 45,
        total_groups: 8,
        active_sessions_today: 12,
        average_score: 78.5
      });

      setRecentGroups([
        {
          id: '1',
          name: '数学A 高校1年',
          description: '基礎的な数学クラス',
          student_count: 15,
          created_at: '2024-01-15T10:00:00Z',
          created_by: session?.user?.email || 'admin@example.com'
        },
        {
          id: '2', 
          name: '英語初級',
          description: '英語の基礎を学ぶクラス',
          student_count: 12,
          created_at: '2024-01-20T14:00:00Z',
          created_by: session?.user?.email || 'admin@example.com'
        }
      ]);
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
      setError('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // --- ホワイトリスト認証（本番用）例 ---
  // const allowedAdmins = process.env.NEXT_PUBLIC_ALLOWED_ADMINS?.split(',') || [];
  // if (session && session.user?.email && !allowedAdmins.includes(session.user.email)) {
  //   return (
  //     <div className="min-h-screen flex items-center justify-center">
  //       <div className="text-center">
  //         <h2 className="text-2xl font-bold text-red-600 mb-4">アクセス権限がありません</h2>
  //         <p className="text-gray-600">管理者にお問い合わせください。</p>
  //         <p className="text-sm text-gray-500 mt-2">メールアドレス: {session.user.email}</p>
  //       </div>
  //     </div>
  //   );
  // }

  if (status === "loading" || loading) {
    return (
      <AdminLayout>
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner size="large" />
        </div>
      </AdminLayout>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-white to-cyan-100">
        <div className="bg-white rounded-xl shadow-lg p-10 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold mb-4 text-indigo-700">管理者用ダッシュボード</h1>
          <p className="mb-6 text-gray-700">この画面は管理者専用です。<br />Googleアカウントでサインインしてください。</p>
          <button
            onClick={() => signIn('google', { callbackUrl: '/admin-top' })}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-full shadow"
          >
            Googleでサインイン
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout>
      {error && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <p className="text-yellow-800">{error}</p>
          <p className="text-sm text-yellow-600 mt-1">
            デモデータを表示しています。
          </p>
        </div>
      )}

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-medium">👥</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    総生徒数
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats.total_students}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-medium">📚</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    管理グループ数
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats.total_groups}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-medium">📈</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    今日のアクティブ
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats.active_sessions_today}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-medium">⭐</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    平均スコア
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats.average_score}%
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 管理メニュー */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Link
          href="/admin-dashboard/groups"
          className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <span className="text-2xl">📚</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">グループ管理</h3>
              <p className="text-gray-600 text-sm">グループの選択・作成・編集</p>
            </div>
          </div>
        </Link>

        <Link
          href="/admin-dashboard/students"
          className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-green-100 p-3 rounded-lg">
              <span className="text-2xl">👥</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">生徒管理</h3>
              <p className="text-gray-600 text-sm">生徒の追加・成績確認</p>
            </div>
          </div>
        </Link>

        <Link
          href="/admin-dashboard/invite-codes"
          className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-orange-100 p-3 rounded-lg">
              <span className="text-2xl">🎫</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">招待コード</h3>
              <p className="text-gray-600 text-sm">生徒招待・紐付け管理</p>
            </div>
          </div>
        </Link>

        <Link
          href="/admin-dashboard/analytics"
          className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-purple-100 p-3 rounded-lg">
              <span className="text-2xl">📊</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">成績分析</h3>
              <p className="text-gray-600 text-sm">詳細な成績データと分析</p>
            </div>
          </div>
        </Link>
      </div>

      {/* 最近のグループ */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            最近作成したグループ
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            管理しているグループの一覧
          </p>
        </div>
        <div className="border-t border-gray-200">
          <ul className="divide-y divide-gray-200">
            {recentGroups.map((group) => (
              <li key={group.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {group.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {group.description} • {group.student_count}名
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">
                      {new Date(group.created_at).toLocaleDateString('ja-JP')}
                    </p>
                    <Link
                      href={`/admin-dashboard/groups/${group.id}`}
                      className="text-indigo-600 hover:text-indigo-900 text-sm"
                    >
                      詳細
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-8 text-center text-gray-500 text-sm">
        ※この画面は管理者専用です。ユーザー用画面へのリンクはありません。
      </div>
    </AdminLayout>
  );
}
