'use client';

import { useSession, signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';

interface Group {
  id: string;
  name: string;
  description: string;
  student_count: number;
  created_at: string;
  created_by: string;
  students: string[];
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
    description: ''
  });

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
          description: '基礎的な数学クラス',
          student_count: 15,
          created_at: '2024-01-15T10:00:00Z',
          created_by: session?.user?.email || 'admin@example.com',
          students: ['student1@example.com', 'student2@example.com']
        },
        {
          id: '2',
          name: '英語初級',
          description: '英語の基礎を学ぶクラス',
          student_count: 12,
          created_at: '2024-01-20T14:00:00Z',
          created_by: session?.user?.email || 'admin@example.com',
          students: ['student3@example.com', 'student4@example.com']
        },
        {
          id: '3',
          name: '物理基礎',
          description: '物理の基本概念を学習',
          student_count: 8,
          created_at: '2024-01-25T16:00:00Z',
          created_by: session?.user?.email || 'admin@example.com',
          students: ['student5@example.com']
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
        students: []
      };

      setGroups([...groups, newGroup]);
      setCreateForm({ name: '', description: '' });
      setShowCreateModal(false);
    } catch (err) {
      console.error('Failed to create group:', err);
      setError('グループの作成に失敗しました');
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('このグループを削除しますか？')) return;

    try {
      setGroups(groups.filter(group => group.id !== groupId));
    } catch (err) {
      console.error('Failed to delete group:', err);
      setError('グループの削除に失敗しました');
    }
  };

  if (status === "loading" || loading) {
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
      {/* ヘッダー */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link href="/admin-dashboard" className="text-xl font-semibold text-gray-900">
                Quiz App 管理者
              </Link>
              <span className="text-indigo-600 font-medium">グループ管理</span>
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
          <div className="mb-8 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                管理グループ
              </h2>
              <p className="mt-2 text-gray-600">
                クラス・グループの選択と作成ができます。
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              新しいグループを作成
            </button>
          </div>

          {error && (
            <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <p className="text-yellow-800">{error}</p>
              <p className="text-sm text-yellow-600 mt-1">
                デモデータを表示しています。
              </p>
            </div>
          )}

          {/* グループ一覧 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => (
              <div key={group.id} className="bg-white rounded-lg shadow border hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {group.name}
                    </h3>
                    <div className="flex space-x-2">
                      <Link
                        href={`/admin-dashboard/groups/${group.id}`}
                        className="text-indigo-600 hover:text-indigo-800 text-sm"
                      >
                        管理
                      </Link>
                      <button
                        onClick={() => handleDeleteGroup(group.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-4">
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

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <Link
                      href={`/admin-dashboard/groups/${group.id}/students`}
                      className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md text-sm font-medium text-center block"
                    >
                      生徒を管理
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {groups.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">📚</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                グループがありません
              </h3>
              <p className="text-gray-600 mb-4">
                新しいグループを作成して、生徒を管理しましょう。
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                グループを作成
              </button>
            </div>
          )}
        </div>
      </main>

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
                    placeholder="例: 数学A 高校1年"
                  />
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
                    placeholder="グループの説明を入力してください"
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
                    setCreateForm({ name: '', description: '' });
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
