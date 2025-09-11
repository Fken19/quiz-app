'use client';

import { useSession, signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';

interface Group {
  id: string;
  name: string;
  description: string;
  created_at: string;
  created_by: string;
}

interface Student {
  id: string;
  email: string;
  display_name: string;
  joined_at: string;
  quiz_count: number;
  average_score: number;
  last_activity: string;
}

export default function GroupDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;
  
  const [group, setGroup] = useState<Group | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStudentEmail, setNewStudentEmail] = useState('');

  useEffect(() => {
    if (status === "unauthenticated") {
      signIn("google");
      return;
    }
    if (status === "authenticated") {
      fetchGroupDetails();
    }
  }, [status, groupId]);

  const fetchGroupDetails = async () => {
    try {
      // デモデータ（実際のAPIと置き換え予定）
      const demoGroups = {
        '1': {
          id: '1',
          name: '数学A 高校1年',
          description: '基礎的な数学クラス',
          created_at: '2024-01-15T10:00:00Z',
          created_by: session?.user?.email || 'admin@example.com'
        },
        '2': {
          id: '2',
          name: '英語初級',
          description: '英語の基礎を学ぶクラス',
          created_at: '2024-01-20T14:00:00Z',
          created_by: session?.user?.email || 'admin@example.com'
        }
      };

      const groupData = demoGroups[groupId as keyof typeof demoGroups];
      if (!groupData) {
        setError('グループが見つかりません');
        return;
      }

      setGroup(groupData);

      // デモ生徒データ
      setStudents([
        {
          id: '1',
          email: 'student1@example.com',
          display_name: '田中太郎',
          joined_at: '2024-01-16T09:00:00Z',
          quiz_count: 15,
          average_score: 78.5,
          last_activity: '2024-01-20T15:30:00Z'
        },
        {
          id: '2',
          email: 'student2@example.com',
          display_name: '佐藤花子',
          joined_at: '2024-01-17T10:00:00Z',
          quiz_count: 12,
          average_score: 82.3,
          last_activity: '2024-01-20T16:45:00Z'
        },
        {
          id: '3',
          email: 'student3@example.com',
          display_name: '鈴木次郎',
          joined_at: '2024-01-18T11:00:00Z',
          quiz_count: 8,
          average_score: 65.8,
          last_activity: '2024-01-19T20:10:00Z'
        }
      ]);
    } catch (err) {
      console.error('Failed to fetch group details:', err);
      setError('グループ詳細の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudent = async () => {
    if (!newStudentEmail.trim()) return;

    try {
      // 実際のAPIコール予定地
      const newStudent: Student = {
        id: (students.length + 1).toString(),
        email: newStudentEmail,
        display_name: newStudentEmail.split('@')[0], // 仮の表示名
        joined_at: new Date().toISOString(),
        quiz_count: 0,
        average_score: 0,
        last_activity: new Date().toISOString()
      };

      setStudents([...students, newStudent]);
      setNewStudentEmail('');
      setShowAddModal(false);
    } catch (err) {
      console.error('Failed to add student:', err);
      setError('生徒の追加に失敗しました');
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (!confirm('この生徒をグループから削除しますか？')) return;

    try {
      setStudents(students.filter(student => student.id !== studentId));
    } catch (err) {
      console.error('Failed to remove student:', err);
      setError('生徒の削除に失敗しました');
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!session || !group) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            グループが見つかりません
          </h2>
          <Link
            href="/admin-dashboard/groups"
            className="text-indigo-600 hover:text-indigo-800"
          >
            グループ一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link href="/admin-dashboard" className="text-xl font-semibold text-gray-900">
                Quiz App 管理者
              </Link>
              <Link href="/admin-dashboard/groups" className="text-gray-600 hover:text-gray-900">
                グループ管理
              </Link>
              <span className="text-indigo-600 font-medium">{group.name}</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">{session.user?.name}</span>
              <img
                src={session.user?.image || "/default-avatar.png"}
                alt="avatar"
                className="w-8 h-8 rounded-full border"
              />
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {error && (
            <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <p className="text-yellow-800">{error}</p>
              <p className="text-sm text-yellow-600 mt-1">
                デモデータを表示しています。
              </p>
            </div>
          )}

          {/* グループ情報 */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                グループ情報
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                グループの詳細情報と設定
              </p>
            </div>
            <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">グループ名</dt>
                  <dd className="mt-1 text-sm text-gray-900">{group.name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">作成日</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(group.created_at).toLocaleDateString('ja-JP')}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">説明</dt>
                  <dd className="mt-1 text-sm text-gray-900">{group.description}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">生徒数</dt>
                  <dd className="mt-1 text-sm text-gray-900">{students.length}名</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">作成者</dt>
                  <dd className="mt-1 text-sm text-gray-900">{group.created_by}</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* 生徒管理 */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    生徒一覧
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">
                    グループに所属する生徒の管理
                  </p>
                </div>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  生徒を追加
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      生徒
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
                      参加日
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {students.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {student.display_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {student.email}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.quiz_count} 回
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.average_score > 0 ? `${student.average_score.toFixed(1)}%` : '未受験'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(student.last_activity).toLocaleDateString('ja-JP')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(student.joined_at).toLocaleDateString('ja-JP')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link
                          href={`/admin-dashboard/students/${student.id}`}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          詳細
                        </Link>
                        <button
                          onClick={() => handleRemoveStudent(student.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {students.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">👥</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  生徒がいません
                </h3>
                <p className="text-gray-600 mb-4">
                  生徒をグループに追加して管理を開始しましょう。
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  生徒を追加
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 生徒追加モーダル */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                生徒を追加
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    メールアドレス *
                  </label>
                  <input
                    type="email"
                    value={newStudentEmail}
                    onChange={(e) => setNewStudentEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="student@example.com"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    生徒のGoogleアカウントのメールアドレスを入力してください
                  </p>
                </div>
              </div>
              
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={handleAddStudent}
                  disabled={!newStudentEmail.trim()}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  追加
                </button>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setNewStudentEmail('');
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
