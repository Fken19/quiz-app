'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiGet, apiPost } from '@/lib/api-utils';
import type { ApiUser, StudentTeacherLink, UserProfile } from '@/types/quiz';

interface StudentRow {
  link: StudentTeacherLink;
  user?: ApiUser | null;
  profile?: UserProfile | null;
}

type SortKey = 'name' | 'linked_at';

export default function TeacherStudentsPage() {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('linked_at');
  const [showEditId, setShowEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ school: '', grade: '', classroom: '', tags: '' });
  const [aliasModalId, setAliasModalId] = useState<string | null>(null);
  const [aliasValue, setAliasValue] = useState('');

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const response = await apiGet('/api/student-teacher-links/').catch(() => ({ results: [] }));
      const links: StudentTeacherLink[] = Array.isArray(response) ? response : response?.results || [];

      const studentIds = Array.from(new Set(links.map((l) => l.student))).filter(Boolean) as string[];
      const users = await Promise.all(studentIds.map((id) => apiGet(`/api/users/${id}/`).catch(() => null)));
      const profiles = await Promise.all(
        studentIds.map((id) => apiGet(`/api/user-profiles/${id}/`).catch(() => null)),
      );
      const userMap = new Map<string, ApiUser>();
      users.forEach((u: any) => {
        if (u && 'user_id' in u) userMap.set(u.user_id, u as ApiUser);
      });
      const profileMap = new Map<string, UserProfile>();
      profiles.forEach((p: any) => {
        if (p && 'user' in p) profileMap.set(p.user, p as UserProfile);
      });

      const rowsData: StudentRow[] = links.map((link) => ({
        link,
        user: userMap.get(link.student),
        profile: profileMap.get(link.student),
      }));
      setRows(rowsData);
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
      await apiPost(`/api/student-teacher-links/${aliasModalId}/alias/`, {
        custom_display_name: aliasValue,
      });
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
        if (statusFilter !== 'all' && row.link.status !== statusFilter) return false;
        if (!keyword) return true;
        const display = row.profile?.display_name || '';
        const email = row.user?.email || '';
        return display.toLowerCase().includes(keyword) || email.toLowerCase().includes(keyword);
      })
      .sort((a, b) => {
        if (sortKey === 'name') {
          const an = (a.profile?.display_name || '').toLowerCase();
          const bn = (b.profile?.display_name || '').toLowerCase();
          return an.localeCompare(bn);
        }
        const at = new Date(a.link.linked_at || a.link.created_at).getTime();
        const bt = new Date(b.link.linked_at || b.link.created_at).getTime();
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
              placeholder="氏名/メールで検索"
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
          <div className="min-w-[900px]">
            <div className="grid grid-cols-8 gap-3 px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50">
              <span>氏名/表示名</span>
              <span>メール</span>
              <span>ステータス</span>
              <span>所属学校</span>
              <span>学年</span>
              <span>クラス/タグ</span>
              <span>連携日時</span>
              <span className="text-right">操作</span>
            </div>
            {filteredRows.map(({ link, user, profile }) => {
              const display = link.custom_display_name || profile?.display_name || '未設定';
              const avatarUrl = profile?.avatar_url || null;
              const statusBadge =
                link.status === 'active'
                  ? 'bg-green-100 text-green-700'
                  : link.status === 'pending'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-200 text-slate-600';
              const school = (user as any)?.school || '-';
              const grade = profile?.grade || '-';
              const classroom = (user as any)?.classroom || '-';
              return (
                <div
                  key={link.student_teacher_link_id}
                  className="grid grid-cols-8 gap-3 px-3 py-3 text-sm text-slate-800 border-b last:border-0 border-slate-100"
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
                      <span className="text-xs text-slate-500">ID: {link.student}</span>
                    </div>
                  </div>
                  <span className="text-xs text-slate-600 break-words">{user?.email || '非公開'}</span>
                  <span>
                    <span className={`px-2 py-1 rounded text-xs inline-block ${statusBadge}`}>{link.status}</span>
                  </span>
                  <span>{school}</span>
                  <span>{grade || '-'}</span>
                  <span className="text-xs text-slate-600">{classroom}</span>
                  <span className="text-xs text-slate-600">
                    {link.linked_at ? new Date(link.linked_at).toLocaleString() : '-'}
                  </span>
                  <div className="flex items-center gap-2 justify-end">
                    <Link
                      href={`/teacher/students/${link.student}`}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      詳細
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setAliasModalId(link.student_teacher_link_id);
                        setAliasValue(display);
                      }}
                      className="px-2 py-1 text-xs rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                    >
                      表示名
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEditId(link.student_teacher_link_id)}
                      className="px-2 py-1 text-xs rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                    >
                      属性編集
                    </button>
                    {link.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleApprove(link.student_teacher_link_id)}
                        className="px-3 py-1 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-700"
                      >
                        承認
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRevoke(link.student_teacher_link_id)}
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
            <p className="text-xs text-slate-500">
              所属学校・学年・クラス・タグは現在 UI のみ実装です。保存APIは今後追加予定です。
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-600">所属学校</label>
                <input
                  type="text"
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={editForm.school}
                  onChange={(e) => setEditForm({ ...editForm, school: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-600">学年</label>
                  <input
                    type="text"
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={editForm.grade}
                    onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600">クラス</label>
                  <input
                    type="text"
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={editForm.classroom}
                    onChange={(e) => setEditForm({ ...editForm, classroom: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-600">タグ（カンマ区切り）</label>
                <input
                  type="text"
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={editForm.tags}
                  onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                />
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
                onClick={() => setShowEditId(null)}
                className="px-4 py-2 text-sm rounded-md bg-slate-200 text-slate-600"
                title="保存API準備中のため閉じるだけです"
              >
                保存（準備中）
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
            <p className="text-xs text-slate-500">
              設定した表示名は、この講師アカウントからのみ閲覧され、ユーザーごとに保存されます。
            </p>
            <div>
              <label className="text-xs text-slate-600">表示名</label>
              <input
                type="text"
                value={aliasValue}
                onChange={(e) => setAliasValue(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
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
