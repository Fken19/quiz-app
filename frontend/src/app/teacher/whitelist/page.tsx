'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-utils';
import type { TeacherWhitelistEntry, ApiUser } from '@/types/quiz';
import { PlusIcon, TrashIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

export default function WhitelistManagementPage() {
  const [entries, setEntries] = useState<TeacherWhitelistEntry[]>([]);
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    can_publish_vocab: false,
    note: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [user, whitelistData] = await Promise.all([
        apiGet('/api/users/me/') as Promise<ApiUser>,
        apiGet('/api/teacher-whitelists/') as Promise<TeacherWhitelistEntry[]>,
      ]);
      setCurrentUser(user);
      setEntries(whitelistData);
    } catch (err) {
      console.error('Failed to load whitelist data', err);
      setError('データの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!formData.email.trim()) {
      setError('メールアドレスを入力してください');
      return;
    }

    try {
      const newEntry = await apiPost('/api/teacher-whitelists/', {
        email: formData.email.trim(),
        can_publish_vocab: formData.can_publish_vocab,
        note: formData.note.trim() || null,
      }) as TeacherWhitelistEntry;

      setEntries([...entries, newEntry]);
      setFormData({ email: '', can_publish_vocab: false, note: '' });
      setShowAddForm(false);
      setSuccess('ホワイトリストに追加しました');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Failed to add whitelist entry', err);
      setError(err?.message || 'ホワイトリストへの追加に失敗しました');
    }
  };

  const handleTogglePublishPermission = async (entry: TeacherWhitelistEntry) => {
    try {
      const updated = await apiPatch(`/api/teacher-whitelists/${entry.teachers_whitelist_id}/`, {
        can_publish_vocab: !entry.can_publish_vocab,
      }) as TeacherWhitelistEntry;

      setEntries(entries.map(e => 
        e.teachers_whitelist_id === entry.teachers_whitelist_id ? updated : e
      ));
      setSuccess('権限を更新しました');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to update permission', err);
      setError('権限の更新に失敗しました');
    }
  };

  const handleRevokeEntry = async (entry: TeacherWhitelistEntry) => {
    if (!confirm(`${entry.email} をホワイトリストから削除しますか?`)) {
      return;
    }

    try {
      if (entry.revoked_at) {
        // Already revoked, delete permanently
        await apiDelete(`/api/teacher-whitelists/${entry.teachers_whitelist_id}/`);
        setEntries(entries.filter(e => e.teachers_whitelist_id !== entry.teachers_whitelist_id));
      } else {
        // Revoke (soft delete)
        const updated = await apiPatch(`/api/teacher-whitelists/${entry.teachers_whitelist_id}/`, {
          revoked_at: new Date().toISOString(),
        }) as TeacherWhitelistEntry;
        setEntries(entries.map(e => 
          e.teachers_whitelist_id === entry.teachers_whitelist_id ? updated : e
        ));
      }
      setSuccess('ホワイトリストから削除しました');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to revoke entry', err);
      setError('削除に失敗しました');
    }
  };

  const handleRestoreEntry = async (entry: TeacherWhitelistEntry) => {
    try {
      const updated = await apiPatch(`/api/teacher-whitelists/${entry.teachers_whitelist_id}/`, {
        revoked_at: null,
      }) as TeacherWhitelistEntry;

      setEntries(entries.map(e => 
        e.teachers_whitelist_id === entry.teachers_whitelist_id ? updated : e
      ));
      setSuccess('ホワイトリストを復元しました');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to restore entry', err);
      setError('復元に失敗しました');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-10 w-10 border-4 border-indigo-500 rounded-full border-t-transparent"></div>
      </div>
    );
  }

  const activeEntries = entries.filter(e => !e.revoked_at);
  const revokedEntries = entries.filter(e => e.revoked_at);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">ホワイトリスト管理</h1>
          <p className="text-slate-600 mt-2">講師アクセス権限を持つメールアドレスの管理</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-lg"
        >
          <PlusIcon className="h-5 w-5" />
          追加
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <XCircleIcon className="h-5 w-5" />
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircleIcon className="h-5 w-5" />
          {success}
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">新規追加</h2>
          <form onSubmit={handleAddEntry} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                メールアドレス <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="example@example.com"
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="can_publish_vocab"
                checked={formData.can_publish_vocab}
                onChange={(e) => setFormData({ ...formData, can_publish_vocab: e.target.checked })}
                className="h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <label htmlFor="can_publish_vocab" className="text-sm text-slate-700">
                語彙の公開権限を付与
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                メモ
              </label>
              <textarea
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                rows={3}
                placeholder="このエントリーに関するメモ（任意）"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
              >
                追加
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setFormData({ email: '', can_publish_vocab: false, note: '' });
                }}
                className="flex-1 bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors font-medium"
              >
                キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active Entries */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            アクティブなエントリー ({activeEntries.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  メールアドレス
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  公開権限
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  メモ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  登録日
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {activeEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    アクティブなエントリーがありません
                  </td>
                </tr>
              ) : (
                activeEntries.map((entry) => (
                  <tr key={entry.teachers_whitelist_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {entry.email}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleTogglePublishPermission(entry)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          entry.can_publish_vocab
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                        }`}
                      >
                        {entry.can_publish_vocab ? '有効' : '無効'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">
                      {entry.note || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(entry.created_at).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleRevokeEntry(entry)}
                        className="text-red-600 hover:text-red-800 transition-colors"
                        title="削除"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revoked Entries */}
      {revokedEntries.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">
              削除済みエントリー ({revokedEntries.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    メールアドレス
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    削除日
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {revokedEntries.map((entry) => (
                  <tr key={entry.teachers_whitelist_id} className="hover:bg-slate-50 transition-colors opacity-60">
                    <td className="px-6 py-4 text-sm text-slate-900 line-through">
                      {entry.email}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {entry.revoked_at && new Date(entry.revoked_at).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleRestoreEntry(entry)}
                        className="text-indigo-600 hover:text-indigo-800 transition-colors text-sm font-medium"
                      >
                        復元
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
