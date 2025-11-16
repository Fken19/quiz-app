'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiGet, apiPost } from '@/lib/api-utils';
interface TeacherStudent {
  student_teacher_link_id: string;
  display_name: string;
  status: string;
  linked_at: string;
  custom_display_name?: string | null;
  local_student_code?: string | null;
  tags?: string[] | null;
  private_note?: string | null;
  kana_for_sort?: string | null;
  color?: string | null;
  avatar_url?: string | null;
}

type SortKey = 'name' | 'linked_at';

export default function TeacherStudentsPage() {
  const [rows, setRows] = useState<TeacherStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('linked_at');
  const [showEditId, setShowEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    local_student_code: '',
    tags: '',
    private_note: '',
    kana_for_sort: '',
    color: '',
  });
  const [aliasModalId, setAliasModalId] = useState<string | null>(null);
  const [aliasValue, setAliasValue] = useState('');

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const response = await apiGet('/api/teacher/students/').catch(() => []);
      const list: TeacherStudent[] = Array.isArray(response) ? response : [];
      setRows(list);
    } catch (err) {
      console.error(err);
      setError('生徒一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      setActionMessage(null);
      await apiPost(`/api/student-teacher-links/${id}/approve/`, {});
      setActionMessage('承認しました');
      await fetchStudents();
    } catch (err) {
      console.error(err);
      setActionMessage('承認に失敗しました');
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      setActionMessage(null);
      await apiPost(`/api/student-teacher-links/${id}/revoke/`, {});
      setActionMessage('解除しました');
      await fetchStudents();
    } catch (err) {
      console.error(err);
      setActionMessage('解除に失敗しました');
    }
  };

  const handleAliasSave = async () => {
    if (!aliasModalId) return;
    try {
      setActionMessage(null);
      await apiPost(
        `/api/teacher/students/`,
        {
          student_teacher_link_id: aliasModalId,
          custom_display_name: aliasValue,
        },
        'PATCH',
      );
      setAliasModalId(null);
      setActionMessage('表示名を更新しました');
      await fetchStudents();
    } catch (err) {
      console.error(err);
      setActionMessage('表示名の更新に失敗しました');
    }
  };

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (statusFilter !== 'all' && row.status !== statusFilter) return false;
        if (!keyword) return true;
        const display = row.display_name || '';
        return display.toLowerCase().includes(keyword);
      })
      .sort((a, b) => {
        if (sortKey === 'name') {
          const an = (a.display_name || '').toLowerCase();
          const bn = (b.display_name || '').toLowerCase();
          return an.localeCompare(bn);
        }
        const at = new Date(a.linked_at || '').getTime();
        const bt = new Date(b.linked_at || '').getTime();
        return bt - at;
      });
  }, [rows, search, statusFilter, sortKey]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-10">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">生徒一覧</h1>
          <p className="text-slate-600">
            講師にリンク済みの生徒を一覧表示します。検索やステータスで絞り込みできます。
          </p>
        </div>
      </header>

      {actionMessage && <p className="text-sm text-slate-700">{actionMessage}</p>}

      <div className="bg-white shadow rounded-lg p-4 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3 flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="氏名で検索"
              className="w-full lg:max-w-md border rounded-md px-3 py-2 text-sm"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm"
            >
              <option value="all">全てのステータス</option>
              <option value="pending">承認待ち</option>
              <option value="active">承認済み</option>
              <option value="revoked">解除済み</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-600">並び替え:</label>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="border rounded-md px-3 py-2 text-sm"
            >
              <option value="linked_at">最終連携日時が新しい順</option>
              <option value="name">名前順</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-6 gap-3 px-3 py-2 text-xs font-semibold text-slate-600 uppercase tracking-wide bg-slate-50">
              <span>氏名/表示名</span>
              <span>ステータス</span>
              <span>タグ</span>
              <span>連携日時</span>
              <span className="text-right">操作</span>
            </div>
            {filteredRows.map((row) => {
              const display = row.display_name || '未設定';
              const avatarUrl = row.avatar_url || null;
              const statusBadge =
                row.status === 'active'
                  ? 'bg-green-100 text-green-700'
                  : row.status === 'pending'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-200 text-slate-600';
              return (
                <div
                  key={row.student_teacher_link_id}
                  className="grid grid-cols-6 gap-3 px-3 py-3 text-sm text-slate-800 border-b last:border-0 border-slate-100"
                >
                  <div className="flex items-center gap-3">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={display} className="w-9 h-9 rounded-full object-cover border border-slate-200" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-semibold">
                        {(display || '').slice(0, 1).toUpperCase() || 'S'}
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900">{display}</span>
                      <span className="text-xs text-slate-500">IDは表示されません</span>
                    </div>
                  </div>
                  <span>
                    <span className={`px-2 py-1 rounded text-xs inline-block ${statusBadge}`}>{row.status}</span>
                  </span>
                  <span className="text-xs text-slate-800">{(row.tags || []).join(',') || '-'}</span>
                  <span className="text-xs text-slate-600">
                    {row.linked_at ? new Date(row.linked_at).toLocaleString() : '-'}
                  </span>
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setAliasModalId(row.student_teacher_link_id);
                        setAliasValue(display);
                      }}
                      className="px-2 py-1 text-xs rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                    >
                      表示名
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditId(row.student_teacher_link_id);
                        setEditForm({
                          local_student_code: row.local_student_code || '',
                          tags: (row.tags || []).join(','),
                          private_note: row.private_note || '',
                          kana_for_sort: row.kana_for_sort || '',
                          color: row.color || '',
                        });
                      }}
                      className="px-2 py-1 text-xs rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                    >
                      属性編集
                    </button>
                    {row.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleApprove(row.student_teacher_link_id)}
                        className="px-3 py-1 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-700"
                      >
                        承認
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRevoke(row.student_teacher_link_id)}
                      className="px-3 py-1 text-xs rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                    >
                      解除
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredRows.length === 0 && (
              <div className="px-3 py-4 text-sm text-slate-500">条件に一致する生徒がいません。</div>
            )}
          </div>
        </div>
      </div>

      {showEditId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40 px-4">
          <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">属性編集</h3>
              <button
                type="button"
                onClick={() => setShowEditId(null)}
                className="text-slate-500 hover:text-slate-700 text-sm"
              >
                閉じる
              </button>
            </div>
            <p className="text-sm text-slate-700">
              講師専用のメモ情報です。生徒には表示されません。
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-800">ローカルコード</label>
                <input
                  type="text"
                  className="w-full border rounded-md px-3 py-2 text-sm text-slate-900"
                  value={editForm.local_student_code}
                  onChange={(e) => setEditForm({ ...editForm, local_student_code: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-800">タグ（カンマ区切り）</label>
                <input
                  type="text"
                  className="w-full border rounded-md px-3 py-2 text-sm text-slate-900"
                  value={editForm.tags}
                  onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-800">メモ</label>
                <textarea
                  className="w-full border rounded-md px-3 py-2 text-sm text-slate-900"
                  rows={3}
                  value={editForm.private_note}
                  onChange={(e) => setEditForm({ ...editForm, private_note: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-800">並び替え用かな</label>
                  <input
                    type="text"
                    className="w-full border rounded-md px-3 py-2 text-sm text-slate-900"
                    value={editForm.kana_for_sort}
                    onChange={(e) => setEditForm({ ...editForm, kana_for_sort: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-800">色コード</label>
                  <input
                    type="text"
                    className="w-full border rounded-md px-3 py-2 text-sm text-slate-900"
                    value={editForm.color}
                    placeholder="#RRGGBB"
                    onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowEditId(null)}
                className="px-4 py-2 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!showEditId) return;
                  setActionMessage(null);
                  try {
                    await apiPost(
                      '/api/teacher/students/',
                      {
                        student_teacher_link_id: showEditId,
                        local_student_code: editForm.local_student_code,
                        tags: editForm.tags
                          .split(',')
                          .map((t) => t.trim())
                          .filter(Boolean),
                        private_note: editForm.private_note,
                        kana_for_sort: editForm.kana_for_sort,
                        color: editForm.color,
                      },
                      'PATCH',
                    );
                    setActionMessage('属性を更新しました');
                    setShowEditId(null);
                    fetchStudents();
                  } catch (err) {
                    console.error(err);
                    setActionMessage('属性の更新に失敗しました');
                  }
                }}
                className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
      {aliasModalId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40 px-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">表示名の編集</h3>
              <button
                type="button"
                onClick={() => setAliasModalId(null)}
                className="text-slate-500 hover:text-slate-700 text-sm"
              >
                閉じる
              </button>
            </div>
            <p className="text-sm text-slate-700">
              設定した表示名は、この講師アカウントからのみ閲覧され、ユーザーごとに保存されます。
            </p>
            <div>
              <label className="text-sm font-medium text-slate-800">表示名</label>
              <input
                type="text"
                value={aliasValue}
                onChange={(e) => setAliasValue(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm text-slate-900"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAliasModalId(null)}
                className="px-3 py-2 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleAliasSave}
                className="px-3 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
