'use client';

import { useSession, signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import LoadingSpinner from '@/components/LoadingSpinner';

interface Student {
  id: string;
  email: string;
  display_name: string;
  status: 'active' | 'pending';
  school: string;
  grade: string;
  class_name: string;
  groups: string[];
  total_quiz_count: number;
  average_score: number;
  last_activity: string;
  joined_at: string;
}

interface InviteToken {
  id: string;
  token: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}

export default function StudentsPage() {
  const { data: session, status } = useSession();
  const [students, setStudents] = useState<Student[]>([]);
  const [inviteTokens, setInviteTokens] = useState<InviteToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'pending'>('all');
  const [showCreateInvite, setShowCreateInvite] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      signIn("google");
      return;
    }
    if (status === "authenticated") {
      fetchStudents();
      fetchInviteTokens();
    }
  }, [status]);

  const fetchStudents = async () => {
    try {
      // デモデータ（実際のAPIと置き換え予定）
      setStudents([
        {
          id: '1',
          email: 'student1@example.com',
          display_name: '田中太郎',
          status: 'active',
          school: '〇〇中学校',
          grade: '中学2年',
          class_name: 'A組',
          groups: ['数学A 高校1年', '物理基礎'],
          total_quiz_count: 25,
          average_score: 78.5,
          last_activity: '2024-01-20T15:30:00Z',
          joined_at: '2024-01-16T09:00:00Z'
        },
        {
          id: '2',
          email: 'student2@example.com',
          display_name: '佐藤花子',
          status: 'active',
          school: '〇〇中学校',
          grade: '中学3年',
          class_name: 'B組',
          groups: ['英語初級', '数学A 高校1年'],
          total_quiz_count: 30,
          average_score: 82.3,
          last_activity: '2024-01-20T16:45:00Z',
          joined_at: '2024-01-17T10:00:00Z'
        },
        {
          id: '3',
          email: 'student3@example.com',
          display_name: '鈴木次郎',
          status: 'pending',
          school: '〇〇中学校',
          grade: '中学1年',
          class_name: 'C組',
          groups: ['数学A 高校1年'],
          total_quiz_count: 18,
          average_score: 65.8,
          last_activity: '2024-01-19T20:10:00Z',
          joined_at: '2024-01-18T11:00:00Z'
        },
        {
          id: '4',
          email: 'student4@example.com',
          display_name: '高橋美咲',
          status: 'active',
          school: '△△中学校',
          grade: '中学2年',
          class_name: 'A組',
          groups: ['英語初級', '物理基礎'],
          total_quiz_count: 35,
          average_score: 88.7,
          last_activity: '2024-01-20T17:20:00Z',
          joined_at: '2024-01-15T08:00:00Z'
        }
      ]);
    } catch (err) {
      console.error('Failed to fetch students:', err);
      setError('生徒データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const fetchInviteTokens = async () => {
    try {
      // デモデータ
      setInviteTokens([
        {
          id: '1',
          token: 'ABC123',
          expires_at: '2024-01-25T23:59:59Z',
          used: false,
          created_at: '2024-01-20T10:00:00Z'
        },
        {
          id: '2', 
          token: 'DEF456',
          expires_at: '2024-01-22T23:59:59Z',
          used: true,
          created_at: '2024-01-18T14:00:00Z'
        }
      ]);
    } catch (error) {
      console.error('Failed to fetch invite tokens:', error);
    }
  };

  const createInviteToken = async () => {
    try {
      // 実際のAPIコール（プロトタイプではデモ）
      const newToken: InviteToken = {
        id: Date.now().toString(),
        token: generateToken(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        used: false,
        created_at: new Date().toISOString()
      };
      setInviteTokens([newToken, ...inviteTokens]);
      setShowCreateInvite(false);
    } catch (error) {
      console.error('Failed to create invite token:', error);
    }
  };

  const generateToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.groups.some(group => group.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = filterStatus === 'all' || student.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  if (status === "loading" || loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="large" />
        </div>
      </AdminLayout>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* ヘッダー */}
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              生徒管理
            </h2>
            <p className="mt-2 text-gray-600">
              全ての生徒の成績と進捗を確認できます。
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <button
              onClick={() => setShowCreateInvite(true)}
              className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              招待コード作成
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <p className="text-yellow-800">{error}</p>
            <p className="text-sm text-yellow-600 mt-1">
              デモデータを表示しています。
            </p>
          </div>
        )}

        {/* 統計カード */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm">✓</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      アクティブ生徒
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {students.filter(s => s.status === 'active').length}
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
                    <span className="text-white text-sm">⏳</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      承認待ち
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {students.filter(s => s.status === 'pending').length}
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
                  <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm">�</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      平均スコア
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {students.filter(s => s.status === 'active').length > 0 
                        ? (students.filter(s => s.status === 'active').reduce((sum, s) => sum + s.average_score, 0) / students.filter(s => s.status === 'active').length).toFixed(1)
                        : 0
                      }%
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
                    <span className="text-white text-sm">�</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      有効な招待コード
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {inviteTokens.filter(t => !t.used && new Date(t.expires_at) > new Date()).length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 検索・フィルター */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700">
                検索
              </label>
              <input
                type="text"
                name="search"
                id="search"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="名前、メール、グループ名"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                ステータス
              </label>
              <select
                id="status"
                name="status"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'pending')}
              >
                <option value="all">すべて</option>
                <option value="active">アクティブ</option>
                <option value="pending">承認待ち</option>
              </select>
            </div>
          </div>
        </div>

        {/* 生徒一覧 */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              生徒一覧 ({filteredStudents.length}名)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    生徒
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ステータス
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    所属グループ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    クイズ回数
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    平均スコア
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    最終活動
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {student.display_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {student.email}
                        </div>
                        <div className="text-xs text-gray-400">
                          {student.school} {student.grade} {student.class_name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        student.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {student.status === 'active' ? 'アクティブ' : '承認待ち'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {student.groups.map((group, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {group}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {student.total_quiz_count} 回
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        student.average_score >= 80 
                          ? 'bg-green-100 text-green-800'
                          : student.average_score >= 60
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {student.average_score.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {student.status === 'active' 
                        ? new Date(student.last_activity).toLocaleDateString('ja-JP')
                        : '未活動'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link
                        href={`/admin-dashboard/students/${student.id}`}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        詳細
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredStudents.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">🔍</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm ? '検索結果がありません' : '生徒がいません'}
              </h3>
              <p className="text-gray-600">
                {searchTerm 
                  ? '検索条件に一致する生徒がありません。'
                  : 'グループに生徒を追加してください。'
                }
              </p>
            </div>
          )}
        </div>

        {/* 招待コード一覧 */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              招待コード
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              生徒の招待に使用するコード一覧
            </p>
          </div>
          <div className="border-t border-gray-200">
            <ul className="divide-y divide-gray-200">
              {inviteTokens.map((token) => (
                <li key={token.id} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="text-sm font-mono font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded">
                        {token.token}
                      </div>
                      <div className="ml-4">
                        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          token.used
                            ? 'bg-gray-100 text-gray-800'
                            : new Date(token.expires_at) > new Date()
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                        }`}>
                          {token.used ? '使用済み' : new Date(token.expires_at) > new Date() ? '有効' : '期限切れ'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-900">
                        作成日: {new Date(token.created_at).toLocaleDateString('ja-JP')}
                      </div>
                      <div className="text-sm text-gray-500">
                        有効期限: {new Date(token.expires_at).toLocaleDateString('ja-JP')}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 招待コード作成モーダル */}
        {showCreateInvite && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3 text-center">
                <h3 className="text-lg font-medium text-gray-900">新しい招待コードを作成</h3>
                <div className="mt-2 px-7 py-3">
                  <p className="text-sm text-gray-500">
                    新しい招待コードを作成しますか？コードは7日間有効です。
                  </p>
                </div>
                <div className="flex justify-center space-x-4 px-4 py-3">
                  <button
                    onClick={() => setShowCreateInvite(false)}
                    className="px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md shadow-sm hover:bg-gray-600"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={createInviteToken}
                    className="px-4 py-2 bg-indigo-600 text-white text-base font-medium rounded-md shadow-sm hover:bg-indigo-700"
                  >
                    作成する
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
