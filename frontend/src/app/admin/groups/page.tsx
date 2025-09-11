'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';

interface Group {
  id: string;
  name: string;
  description: string;
  created_at: string;
  member_count: number;
  avg_score: number;
  total_quiz_sessions: number;
  teacher?: string;
}

export default function AdminGroupsPage() {
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
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    fetchGroups();
  }, [session, status, router]);

  const fetchGroups = async () => {
    try {
      // デモデータを使用
      setGroups([
        {
          id: '1',
          name: '数学A',
          description: '高校1年生向けの数学基礎クラス',
          created_at: '2024-01-10T09:00:00Z',
          member_count: 15,
          avg_score: 76.8,
          total_quiz_sessions: 120,
          teacher: '山田先生'
        },
        {
          id: '2',
          name: '数学B',
          description: '高校2年生向けの数学応用クラス',
          created_at: '2024-01-10T09:00:00Z',
          member_count: 12,
          avg_score: 82.3,
          total_quiz_sessions: 96,
          teacher: '山田先生'
        },
        {
          id: '3',
          name: '物理',
          description: '高校物理クラス',
          created_at: '2024-01-15T10:00:00Z',
          member_count: 8,
          avg_score: 71.5,
          total_quiz_sessions: 64,
          teacher: '田中先生'
        },
        {
          id: '4',
          name: '化学基礎',
          description: '化学の基礎を学ぶクラス',
          created_at: '2024-01-20T11:00:00Z',
          member_count: 10,
          avg_score: 68.9,
          total_quiz_sessions: 40,
          teacher: '佐藤先生'
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
    try {
      // 実際のAPIコール予定地
      console.log('Creating group:', createForm);
      
      // デモ用の新しいグループを追加
      const newGroup: Group = {
        id: (groups.length + 1).toString(),
        name: createForm.name,
        description: createForm.description,
        created_at: new Date().toISOString(),
        member_count: 0,
        avg_score: 0,
        total_quiz_sessions: 0,
        teacher: session?.user?.name || '管理者'
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
    if (!confirm('このグループを削除しますか？メンバーも全て削除されます。')) {
      return;
    }
    
    try {
      // 実際のAPIコール予定地
      console.log('Deleting group:', groupId);
      
      // デモ用の削除
      setGroups(groups.filter(group => group.id !== groupId));
    } catch (err) {
      console.error('Failed to delete group:', err);
      setError('グループの削除に失敗しました');
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
              <Link href="/admin" className="text-xl font-semibold text-gray-900">
                Quiz App
              </Link>
              <Link href="/admin" className="text-gray-600 hover:text-gray-900">
                管理者画面
              </Link>
              <span className="text-indigo-600 font-medium">グループ管理</span>
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
          <div className="mb-8 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                グループ管理
              </h2>
              <p className="mt-2 text-gray-600">
                クラス・グループの作成と管理ができます。
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

          {/* グループ統計 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">👥</span>
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
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">👤</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        総メンバー数
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {groups.reduce((sum, group) => sum + group.member_count, 0)}
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
                    <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">📊</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        平均スコア
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {groups.length > 0 
                          ? (groups.reduce((sum, group) => sum + group.avg_score, 0) / groups.length).toFixed(1)
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
                    <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">📝</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        総クイズ回数
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {groups.reduce((sum, group) => sum + group.total_quiz_sessions, 0)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* グループ一覧 */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                グループ一覧
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
              {groups.map((group) => (
                <div key={group.id} className="bg-gray-50 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="text-lg font-semibold text-gray-900">
                      {group.name}
                    </h4>
                    <div className="flex space-x-2">
                      <Link
                        href={`/admin/groups/${group.id}`}
                        className="text-indigo-600 hover:text-indigo-800 text-sm"
                      >
                        詳細
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
                      <span className="text-gray-500">メンバー数:</span>
                      <span className="font-medium">{group.member_count}人</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">平均スコア:</span>
                      <span className="font-medium">{group.avg_score.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">クイズ回数:</span>
                      <span className="font-medium">{group.total_quiz_sessions}回</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">担当講師:</span>
                      <span className="font-medium">{group.teacher}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">作成日:</span>
                      <span className="font-medium">
                        {new Date(group.created_at).toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {groups.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">👥</div>
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
                    グループ名
                  </label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({...createForm, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="例: 数学A"
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
