'use client';

import { useSession, signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import { TeacherGroupsAPI } from '@/lib/api-utils';
import type { TeacherGroup } from '@/types/quiz';

export default function GroupsPage() {
  const { data: session, status } = useSession();
  const [groups, setGroups] = useState<TeacherGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    // 追加の任意メタは今は未対応（必要なら別モデルで拡張）
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
      const res = await TeacherGroupsAPI.list();
      const items: TeacherGroup[] = Array.isArray(res) ? res : (res?.results ?? []);
      setGroups(items);
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
      const created = await TeacherGroupsAPI.create(createForm.name.trim());
      const item: TeacherGroup = created;
      setGroups((prev) => [item, ...prev]);
      setCreateForm({ name: '' });
      setShowCreateModal(false);
    } catch (err) {
      console.error('Failed to create group:', err);
      setError('グループの作成に失敗しました');
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('このグループを削除しますか？生徒は他のグループに移動または削除されます。')) return;

    try {
      await TeacherGroupsAPI.delete(groupId);
      setGroups((prev) => prev.filter(group => group.id !== groupId));
    } catch (err) {
      console.error('Failed to delete group:', err);
      setError('グループの削除に失敗しました');
    }
  };

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase())
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
            <p className="mt-2 text-gray-600">クラス・グループの作成と管理ができます。</p>
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
                      合計（参考）
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      —
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
                      —
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
              placeholder="グループ名で検索..."
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
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">生徒数:</span>
                    <span className="font-medium">—</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">作成日:</span>
                    <span className="font-medium">
                      {group.created_at ? new Date(group.created_at).toLocaleDateString('ja-JP') : '-'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                  <Link
                    href={`/admin-dashboard/groups/${group.id}`}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md text-sm font-medium text-center block"
                  >
                    生徒を管理
                  </Link>
                  <Link
                    href={`/admin-dashboard/groups/${group.id}`}
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
      {searchTerm ? '検索条件に一致するグループがありません。' : '新しいグループを作成して、生徒を管理しましょう。'}
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">グループ名 *</label>
                    <input
                      type="text"
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black placeholder-gray-500"
                      placeholder="例: A中1年 特進クラス"
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
                      setCreateForm({ name: '' });
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
