'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';

interface AdminStats {
  total_users: number;
  total_groups: number;
  active_sessions_today: number;
  total_questions: number;
}

interface User {
  id: string;
  email: string;
  username: string;
  display_name: string;
  is_staff: boolean;
  created_at: string;
}

interface Group {
  id: string;
  name: string;
  owner_admin: string;
  created_at: string;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    total_users: 0,
    total_groups: 0,
    active_sessions_today: 0,
    total_questions: 0
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    // 管理者権限チェック（実際のAPIから取得する場合）
    fetchAdminData();
  }, [session, status, router]);

  const fetchAdminData = async () => {
    try {
      // デモデータを使用（実際のAPIが利用できない場合）
      setUsers([
        {
          id: '1',
          email: 'student1@example.com',
          username: 'student1',
          display_name: '田中太郎',
          is_staff: false,
          created_at: '2024-01-15T10:30:00Z'
        },
        {
          id: '2',
          email: 'student2@example.com',
          username: 'student2',
          display_name: '佐藤花子',
          is_staff: false,
          created_at: '2024-01-16T14:20:00Z'
        },
        {
          id: '3',
          email: 'teacher@school.com',
          username: 'teacher',
          display_name: '山田先生',
          is_staff: true,
          created_at: '2024-01-01T09:00:00Z'
        }
      ]);

      setGroups([
        {
          id: '1',
          name: '高校3年A組',
          owner_admin: '山田先生',
          created_at: '2024-01-10T09:00:00Z'
        },
        {
          id: '2',
          name: '中学3年特進クラス',
          owner_admin: '山田先生',
          created_at: '2024-01-12T10:00:00Z'
        }
      ]);

      setStats({
        total_users: 3,
        total_groups: 2,
        active_sessions_today: 15,
        total_questions: 150
      });

    } catch (err) {
      console.error('Failed to fetch admin data:', err);
      setError('管理者データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ナビゲーションバー */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link href="/dashboard" className="text-xl font-semibold text-gray-900">
                Quiz App
              </Link>
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                ダッシュボード
              </Link>
              <span className="text-indigo-600 font-medium">管理者画面</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                {session.user?.name} (管理者)
              </span>
              <button
                onClick={() => router.push('/auth/signout')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-md text-sm font-medium"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">
              管理者ダッシュボード
            </h2>
            <p className="mt-2 text-gray-600">
              塾・学校の管理者用画面です。生徒の成績や進捗を管理できます。
            </p>
          </div>

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
                        総ユーザー数
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.total_users}
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
                        クラス数
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
                      <span className="text-white text-sm font-medium">📊</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        今日のセッション
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
                      <span className="text-white text-sm font-medium">❓</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        問題数
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.total_questions}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 管理メニュー */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <Link
              href="/admin/users"
              className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200"
            >
              <div className="flex items-center space-x-4">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <span className="text-2xl">👥</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">ユーザー管理</h3>
                  <p className="text-gray-600 text-sm">生徒・講師の管理</p>
                </div>
              </div>
            </Link>

            <Link
              href="/admin/groups"
              className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200"
            >
              <div className="flex items-center space-x-4">
                <div className="bg-green-100 p-3 rounded-lg">
                  <span className="text-2xl">�</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">グループ管理</h3>
                  <p className="text-gray-600 text-sm">クラス・グループの管理</p>
                </div>
              </div>
            </Link>
          </div>

          {/* 最近の活動 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 最新ユーザー */}
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  最新登録ユーザー
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  最近登録されたユーザー一覧
                </p>
              </div>
              <div className="border-t border-gray-200">
                <ul className="divide-y divide-gray-200">
                  {users.slice(0, 5).map((user) => (
                    <li key={user.id} className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {user.display_name || user.username}
                          </p>
                          <p className="text-sm text-gray-500">
                            {user.email}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.is_staff 
                              ? 'bg-purple-100 text-purple-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {user.is_staff ? '講師' : '生徒'}
                          </span>
                          <p className="text-sm text-gray-500 mt-1">
                            {new Date(user.created_at).toLocaleDateString('ja-JP')}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* クラス一覧 */}
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  管理中のクラス
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  現在管理しているクラス一覧
                </p>
              </div>
              <div className="border-t border-gray-200">
                <ul className="divide-y divide-gray-200">
                  {groups.map((group) => (
                    <li key={group.id} className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {group.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            管理者: {group.owner_admin}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">
                            {new Date(group.created_at).toLocaleDateString('ja-JP')}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
