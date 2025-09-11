'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';

interface User {
  id: string;
  email: string;
  username: string;
  display_name: string;
  is_staff: boolean;
  created_at: string;
  last_login?: string;
  quiz_sessions_count?: number;
  average_score?: number;
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'student' | 'staff'>('all');

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    fetchUsers();
  }, [session, status, router]);

  const fetchUsers = async () => {
    try {
      // デモデータを使用
      setUsers([
        {
          id: '1',
          email: 'student1@example.com',
          username: 'student1',
          display_name: '田中太郎',
          is_staff: false,
          created_at: '2024-01-15T10:30:00Z',
          last_login: '2024-01-20T15:30:00Z',
          quiz_sessions_count: 15,
          average_score: 78.5
        },
        {
          id: '2',
          email: 'student2@example.com',
          username: 'student2',
          display_name: '佐藤花子',
          is_staff: false,
          created_at: '2024-01-16T14:20:00Z',
          last_login: '2024-01-20T16:45:00Z',
          quiz_sessions_count: 12,
          average_score: 82.3
        },
        {
          id: '3',
          email: 'student3@example.com',
          username: 'student3',
          display_name: '鈴木次郎',
          is_staff: false,
          created_at: '2024-01-17T09:15:00Z',
          last_login: '2024-01-19T20:10:00Z',
          quiz_sessions_count: 8,
          average_score: 65.8
        },
        {
          id: '4',
          email: 'teacher@school.com',
          username: 'teacher',
          display_name: '山田先生',
          is_staff: true,
          created_at: '2024-01-01T09:00:00Z',
          last_login: '2024-01-20T08:30:00Z',
          quiz_sessions_count: 2,
          average_score: 95.0
        },
        {
          id: '5',
          email: 'student4@example.com',
          username: 'student4',
          display_name: '高橋美咲',
          is_staff: false,
          created_at: '2024-01-18T13:45:00Z',
          last_login: '2024-01-20T17:20:00Z',
          quiz_sessions_count: 20,
          average_score: 88.7
        }
      ]);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError('ユーザーデータの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = 
      filterRole === 'all' ||
      (filterRole === 'staff' && user.is_staff) ||
      (filterRole === 'student' && !user.is_staff);
    
    return matchesSearch && matchesRole;
  });

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
              <Link href="/admin" className="text-xl font-semibold text-gray-900">
                Quiz App
              </Link>
              <Link href="/admin" className="text-gray-600 hover:text-gray-900">
                管理者画面
              </Link>
              <span className="text-indigo-600 font-medium">ユーザー管理</span>
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
              ユーザー管理
            </h2>
            <p className="mt-2 text-gray-600">
              生徒・講師のアカウント管理と成績確認ができます。
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

          {/* 検索・フィルター */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                  検索
                </label>
                <input
                  type="text"
                  id="search"
                  placeholder="名前、メール、ユーザー名で検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="role-filter" className="block text-sm font-medium text-gray-700 mb-2">
                  役割でフィルター
                </label>
                <select
                  id="role-filter"
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value as 'all' | 'student' | 'staff')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="all">すべて</option>
                  <option value="student">生徒</option>
                  <option value="staff">講師</option>
                </select>
              </div>
            </div>
          </div>

          {/* ユーザー一覧 */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                ユーザー一覧 ({filteredUsers.length}名)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ユーザー
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      役割
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      クイズ回数
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      平均スコア
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      最終ログイン
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      登録日
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {user.display_name || user.username}
                          </div>
                          <div className="text-sm text-gray-500">
                            {user.email}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.is_staff 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {user.is_staff ? '講師' : '生徒'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.quiz_sessions_count || 0} 回
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.average_score ? `${user.average_score.toFixed(1)}%` : '未受験'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.last_login 
                          ? new Date(user.last_login).toLocaleDateString('ja-JP') 
                          : 'なし'
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString('ja-JP')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          詳細
                        </Link>
                        <button className="text-red-600 hover:text-red-900">
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {filteredUsers.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">👥</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  ユーザーが見つかりません
                </h3>
                <p className="text-gray-600">
                  検索条件に一致するユーザーがありません。
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
