'use client';

import { useSession, signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import LoadingSpinner from '@/components/LoadingSpinner';

interface Group {
  id: string;
  name: string;
  description: string;
  student_count: number;
  created_at: string;
  created_by: string;
  students: string[];
  school?: string;
  grade?: string;
  class_name?: string;
}

export default function GroupsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    school: '',
    grade: '',
    class_name: ''
  });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (status === "unauthenticated") {
      signIn("google");
      return;
    }
    if (status === "authenticated") {
      fetchGroups();
    }
  }, [status]);

  const fetchGroups = async () => {
    try {
      // デモデータ（実際のAPIと置き換え予定）
      setGroups([
        {
          id: '1',
          name: '数学A 高校1年',
          description: '基礎的な数学クラス・代数と幾何の基本',
          student_count: 15,
          created_at: '2024-01-15T10:00:00Z',
          created_by: session?.user?.email || 'admin@example.com',
          students: ['student1@example.com', 'student2@example.com'],
          school: '〇〇中学校',
          grade: '中学2年',
          class_name: 'A組'
        },
        {
          id: '2',
          name: '英語初級',
          description: '英語の基礎を学ぶクラス・語彙力と文法強化',
          student_count: 12,
          created_at: '2024-01-20T14:00:00Z',
          created_by: session?.user?.email || 'admin@example.com',
          students: ['student3@example.com', 'student4@example.com'],
          school: '〇〇中学校',
          grade: '中学3年',
          class_name: 'B組'
        },
        {
          id: '3',
          name: '英語初級（△△中）',
          description: '△△中学校英語初級クラス',
          student_count: 8,
          created_at: '2024-01-25T16:00:00Z',
          created_by: session?.user?.email || 'admin@example.com',
          students: ['student5@example.com'],
          school: '△△中学校',
          grade: '中学1年',
          class_name: 'C組'
        }
      ]);
    } catch (err) {
      console.error('Failed to fetch groups:', err);
      setError('グループデータの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!createForm.name.trim()) return;

    try {
      // 実際のAPIコール予定地
      const newGroup: Group = {
        id: (groups.length + 1).toString(),
        name: createForm.name,
        description: createForm.description,
        student_count: 0,
        created_at: new Date().toISOString(),
        created_by: session?.user?.email || 'admin@example.com',
        students: [],
        school: createForm.school,
        grade: createForm.grade,
        class_name: createForm.class_name
      };

      setGroups([...groups, newGroup]);
      setCreateForm({ name: '', description: '', school: '', grade: '', class_name: '' });
      setShowCreateModal(false);
    } catch (err) {
      console.error('Failed to create group:', err);
      setError('グループの作成に失敗しました');
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('このグループを削除しますか？生徒は他のグループに移動または削除されます。')) return;

    try {
      setGroups(groups.filter(group => group.id !== groupId));
    } catch (err) {
      console.error('Failed to delete group:', err);
      setError('グループの削除に失敗しました');
    }
  };

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.school?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.grade?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              グループ管理
            </h2>
            <p className="mt-2 text-gray-600">
              クラス・グループの選択と作成ができます。
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <button
              onClick={() => setShowCreateModal(true)}
              className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              新しいグループを作成
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm">📚</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      総グループ数
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {groups.length}
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
                    <span className="text-white text-sm">👥</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      総生徒数
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {groups.reduce((sum, g) => sum + g.student_count, 0)}
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
                    <span className="text-white text-sm">📊</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      平均グループサイズ
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {groups.length > 0 
                        ? Math.round(groups.reduce((sum, g) => sum + g.student_count, 0) / groups.length)
                        : 0
                      }名
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 検索 */}
        <div className="bg-white shadow rounded-lg p-6">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700">
              検索
            </label>
            <input
              type="text"
              name="search"
              id="search"
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="グループ名、説明、学校名で検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* グループ一覧 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGroups.map((group) => (
            <div key={group.id} className="bg-white rounded-lg shadow border hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {group.name}
                    </h3>
                    {group.school && (
                      <div className="text-xs text-gray-500 mb-2">
                        {group.school} {group.grade} {group.class_name}
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-1 ml-2">
                    <Link
                      href={`/admin-dashboard/groups/${group.id}`}
                      className="text-indigo-600 hover:text-indigo-800 text-sm px-2 py-1 rounded hover:bg-indigo-50"
                    >
                      管理
                    </Link>
                    <button
                      onClick={() => handleDeleteGroup(group.id)}
                      className="text-red-600 hover:text-red-800 text-sm px-2 py-1 rounded hover:bg-red-50"
                    >
                      削除
                    </button>
                  </div>
                </div>
                
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                  {group.description}
                </p>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">生徒数:</span>
                    <span className="font-medium">{group.student_count}名</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">作成日:</span>
                    <span className="font-medium">
                      {new Date(group.created_at).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                  <Link
                    href={`/admin-dashboard/groups/${group.id}/students`}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md text-sm font-medium text-center block"
                  >
                    生徒を管理
                  </Link>
                  <Link
                    href={`/admin-dashboard/groups/${group.id}/tests`}
                    className="w-full bg-indigo-100 hover:bg-indigo-200 text-indigo-800 px-4 py-2 rounded-md text-sm font-medium text-center block"
                  >
                    テストを作成
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredGroups.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📚</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? '検索結果がありません' : 'グループがありません'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm 
                ? '検索条件に一致するグループがありません。'
                : '新しいグループを作成して、生徒を管理しましょう。'
              }
            </p>
            {!searchTerm && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                グループを作成
              </button>
            )}
          </div>
        )}

        {/* グループ作成モーダル */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  新しいグループを作成
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      グループ名 *
                    </label>
                    <input
                      type="text"
                      value={createForm.name}
                      onChange={(e) => setCreateForm({...createForm, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="例: 数学A 中学2年"
                    />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        学校
                      </label>
                      <input
                        type="text"
                        value={createForm.school}
                        onChange={(e) => setCreateForm({...createForm, school: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="〇〇中学校"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        学年
                      </label>
                      <select
                        value={createForm.grade}
                        onChange={(e) => setCreateForm({...createForm, grade: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">選択</option>
                        <option value="中学1年">中学1年</option>
                        <option value="中学2年">中学2年</option>
                        <option value="中学3年">中学3年</option>
                        <option value="高校1年">高校1年</option>
                        <option value="高校2年">高校2年</option>
                        <option value="高校3年">高校3年</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        クラス
                      </label>
                      <input
                        type="text"
                        value={createForm.class_name}
                        onChange={(e) => setCreateForm({...createForm, class_name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="A組"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      説明
                    </label>
                    <textarea
                      value={createForm.description}
                      onChange={(e) => setCreateForm({...createForm, description: e.target.value})}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="グループの説明を入力してください（学習内容、目標など）"
                    />
                  </div>
                </div>
                
                <div className="flex space-x-3 mt-6">
                  <button
                    onClick={handleCreateGroup}
                    disabled={!createForm.name.trim()}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    作成
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setCreateForm({ name: '', description: '', school: '', grade: '', class_name: '' });
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
    </AdminLayout>
  );
}
