'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api-utils';

type RosterFolder = {
  roster_folder_id: string;
  name: string;
  notes?: string | null;
  sort_order?: number | null;
  member_count: number;
  created_at?: string;
};

type TeacherStudent = {
  student_teacher_link_id: string;
  display_name: string;
  status: string;
  avatar_url?: string | null;
};

type GroupMember = {
  roster_membership_id: string;
  roster_folder_id: string;
  student_teacher_link_id: string | null;
  display_name: string;
  status: string;
  avatar_url?: string;
  added_at: string;
  note?: string | null;
};

export default function TeacherGroupsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [groups, setGroups] = useState<RosterFolder[]>([]);
  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [form, setForm] = useState({ name: '', notes: '', sort_order: '0' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [memberModalId, setMemberModalId] = useState<string | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [memberSelect, setMemberSelect] = useState('');
  const [memberNote, setMemberNote] = useState('');

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const res = await apiGet('/api/roster-folders/');
      const list: RosterFolder[] = Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : [];
      setGroups(list);
    } catch (err) {
      console.error(err);
      setError('グループ一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await apiGet('/api/teacher/students/');
      const list: TeacherStudent[] = Array.isArray(res) ? res : [];
      setStudents(list);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMembers = async (folderId: string) => {
    try {
      const res = await apiGet(`/api/roster-memberships/?roster_folder_id=${folderId}`);
      const list: GroupMember[] = Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : [];
      setMembers(list);
    } catch (err) {
      console.error(err);
      setActionMessage('メンバー取得に失敗しました');
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchStudents();
  }, []);

  const resetForm = () => {
    setForm({ name: '', notes: '', sort_order: '0' });
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setActionMessage(null);
    try {
      const payload = {
        name: form.name.trim(),
        notes: form.notes || null,
        sort_order: Number.isNaN(Number(form.sort_order)) ? 0 : Number(form.sort_order),
      };
      if (editingId) {
        await apiPatch(`/api/roster-folders/${editingId}/`, payload);
        setActionMessage('グループを更新しました');
      } else {
        await apiPost('/api/roster-folders/', payload);
        setActionMessage('グループを作成しました');
      }
      resetForm();
      fetchGroups();
    } catch (err) {
      console.error(err);
      setActionMessage('グループの保存に失敗しました');
    }
  };

  const handleEdit = (folder: RosterFolder) => {
    setEditingId(folder.roster_folder_id);
    setForm({
      name: folder.name,
      notes: folder.notes || '',
      sort_order: String(folder.sort_order ?? 0),
    });
  };

  const handleDelete = async (folderId: string) => {
    if (!window.confirm('このグループを削除しますか？メンバー設定も解除されます。')) return;
    setActionMessage(null);
    try {
      await apiDelete(`/api/roster-folders/${folderId}/`);
      setActionMessage('グループを削除しました');
      if (editingId === folderId) resetForm();
      fetchGroups();
    } catch (err) {
      console.error(err);
      setActionMessage('グループの削除に失敗しました');
    }
  };

  const openMembers = (folderId: string) => {
    setMemberModalId(folderId);
    setMemberSelect('');
    setMemberNote('');
    fetchMembers(folderId);
  };

  const handleAddMember = async () => {
    if (!memberModalId || !memberSelect) return;
    setActionMessage(null);
    try {
      await apiPost('/api/roster-memberships/', {
        roster_folder_id: memberModalId,
        student_teacher_link_id: memberSelect,
        note: memberNote || null,
      });
      setActionMessage('メンバーを追加しました');
      setMemberSelect('');
      setMemberNote('');
      fetchMembers(memberModalId);
      fetchGroups();
    } catch (err) {
      console.error(err);
      setActionMessage('メンバー追加に失敗しました');
    }
  };

  const handleRemoveMember = async (membershipId: string) => {
    if (!memberModalId) return;
    try {
      await apiDelete(`/api/roster-memberships/${membershipId}/`);
      setMembers((prev) => prev.filter((m) => m.roster_membership_id !== membershipId));
      setActionMessage('メンバーを削除しました');
      fetchGroups();
    } catch (err) {
      console.error(err);
      setActionMessage('メンバー削除に失敗しました');
    }
  };

  const selectedFolder = useMemo(
    () => groups.find((g) => g.roster_folder_id === memberModalId),
    [groups, memberModalId],
  );

  const studentOptions = useMemo(() => {
    const existing = new Set(members.map((m) => m.student_teacher_link_id));
    return students.filter((s) => !existing.has(s.student_teacher_link_id));
  }, [students, members]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-10 w-10 rounded-full border-b-2 border-indigo-600" />
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
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">グループ管理</h1>
        <p className="text-slate-600">roster_folders / roster_memberships を使ってクラスや講座を管理します。</p>
      </header>

      {actionMessage && <p className="text-sm text-slate-700">{actionMessage}</p>}

      <div className="bg-white shadow rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">グループ一覧</h2>
          <button
            type="button"
            className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
            onClick={resetForm}
          >
            新規グループ
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[780px] w-full text-sm text-slate-800">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="px-3 py-2 text-left">グループ名</th>
                <th className="px-3 py-2 text-left">メモ</th>
                <th className="px-3 py-2 text-right">並び順</th>
                <th className="px-3 py-2 text-right">所属生徒</th>
                <th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.roster_folder_id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-semibold text-slate-900">{g.name}</td>
                  <td className="px-3 py-2 text-slate-700">{g.notes || '-'}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{g.sort_order ?? 0}</td>
                  <td className="px-3 py-2 text-right">{g.member_count}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-2 text-xs text-slate-600">
                      <button
                        className="px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
                        onClick={() => handleEdit(g)}
                      >
                        編集
                      </button>
                      <button
                        className="px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
                        onClick={() => openMembers(g.roster_folder_id)}
                      >
                        メンバー
                      </button>
                      <button
                        className="px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
                        onClick={() => handleDelete(g.roster_folder_id)}
                      >
                        削除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {groups.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-sm text-slate-500">
                    グループはまだありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-4 space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">グループ編集</h2>
        <p className="text-xs text-slate-500">保存すると roster_folders に反映されます。</p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-slate-600">グループ名</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="例: 中3Aクラス"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-600">メモ</label>
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="任意"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-600">並び順</label>
            <input
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
              type="number"
            />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={resetForm}
            className="px-4 py-2 rounded-md border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
          >
            クリア
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
          >
            {editingId ? '更新' : '追加'}
          </button>
        </div>
      </div>

      {memberModalId && selectedFolder && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40 px-4">
          <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{selectedFolder.name} のメンバー</h3>
                <p className="text-xs text-slate-500">student_teacher_links 経由でひも付けます。</p>
              </div>
              <button
                type="button"
                onClick={() => setMemberModalId(null)}
                className="text-slate-500 hover:text-slate-700 text-sm"
              >
                閉じる
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <label className="text-xs text-slate-600">生徒</label>
                <select
                  value={memberSelect}
                  onChange={(e) => setMemberSelect(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                >
                  <option value="">選択してください</option>
                  {studentOptions.map((s) => (
                    <option key={s.student_teacher_link_id} value={s.student_teacher_link_id}>
                      {s.display_name} ({s.status})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-600">メモ</label>
                <input
                  value={memberNote}
                  onChange={(e) => setMemberNote(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  placeholder="任意"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleAddMember}
                  className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
                >
                  追加
                </button>
              </div>
            </div>

            <div className="border rounded-lg border-slate-200 divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
              {members.map((m) => (
                <div key={m.roster_membership_id} className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-3">
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt={m.display_name} className="w-9 h-9 rounded-full object-cover border border-slate-200" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-semibold">
                        {(m.display_name || 'S').slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900">{m.display_name}</span>
                      <span className="text-xs text-slate-500">{m.status}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    {m.note && <span className="text-slate-500">{m.note}</span>}
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(m.roster_membership_id)}
                      className="px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
                    >
                      解除
                    </button>
                  </div>
                </div>
              ))}
              {members.length === 0 && (
                <div className="px-3 py-4 text-sm text-slate-500">メンバーはまだいません。</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
