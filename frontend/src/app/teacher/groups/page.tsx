'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api-utils';

type RosterFolder = {
  roster_folder_id: string;
  parent_folder_id?: string | null;
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
  tags?: string[] | null;
  local_student_code?: string | null;
};

type FolderForm = {
  name: string;
  notes: string;
  sort_order: string;
  parent_folder_id: string;
};

type AvailableFolder = RosterFolder & { depth: number };

type MemberSelection = {
  id: string;
  display_name: string;
  status: string;
};

export default function TeacherGroupsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [folders, setFolders] = useState<RosterFolder[]>([]);
  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);

  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderForm, setFolderForm] = useState<FolderForm>({ name: '', notes: '', sort_order: '0', parent_folder_id: '' });
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);

  const [showMemberModal, setShowMemberModal] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSelection, setMemberSelection] = useState<Record<string, boolean>>({});
  const [memberNote, setMemberNote] = useState('');

  const fetchFolders = async () => {
    try {
      const res = await apiGet('/api/roster-folders/');
      const list: RosterFolder[] = Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : [];
      setFolders(list);
      if (!selectedFolderId && list.length > 0) {
        setSelectedFolderId(list[0].roster_folder_id);
      }
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
    fetchFolders();
    fetchStudents();
  }, []);

  useEffect(() => {
    if (selectedFolderId) {
      fetchMembers(selectedFolderId);
    } else {
      setMembers([]);
    }
  }, [selectedFolderId]);

  const availableFolders: AvailableFolder[] = useMemo(() => {
    const map = new Map<string | null, RosterFolder[]>();
    folders.forEach((f) => {
      const key = f.parent_folder_id || null;
      const arr = map.get(key) || [];
      arr.push(f);
      map.set(key, arr);
    });
    const sortFn = (a: RosterFolder, b: RosterFolder) => {
      const orderA = typeof a.sort_order === 'number' ? a.sort_order : 0;
      const orderB = typeof b.sort_order === 'number' ? b.sort_order : 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    };
    map.forEach((arr) => arr.sort(sortFn));

    const result: AvailableFolder[] = [];
    const walk = (parent: string | null, depth: number) => {
      const children = map.get(parent) || [];
      children.forEach((child) => {
        result.push({ ...child, depth });
        walk(child.roster_folder_id, depth + 1);
      });
    };
    walk(null, 0);
    return result;
  }, [folders]);

  const selectedFolder = useMemo(
    () => folders.find((f) => f.roster_folder_id === selectedFolderId) || null,
    [folders, selectedFolderId],
  );

  const resetFolderForm = () => {
    setFolderForm({ name: '', notes: '', sort_order: '0', parent_folder_id: '' });
    setEditingFolderId(null);
  };

  const openCreateFolder = () => {
    resetFolderForm();
    setShowFolderModal(true);
  };

  const openEditFolder = (folder: RosterFolder) => {
    setEditingFolderId(folder.roster_folder_id);
    setFolderForm({
      name: folder.name,
      notes: folder.notes || '',
      sort_order: String(folder.sort_order ?? 0),
      parent_folder_id: folder.parent_folder_id || '',
    });
    setShowFolderModal(true);
  };

  const saveFolder = async () => {
    if (!folderForm.name.trim()) return;
    setActionMessage(null);
    const payload = {
      name: folderForm.name.trim(),
      notes: folderForm.notes || null,
      sort_order: Number.isNaN(Number(folderForm.sort_order)) ? 0 : Number(folderForm.sort_order),
      parent_folder: folderForm.parent_folder_id || null,
    };
    try {
      if (editingFolderId) {
        await apiPatch(`/api/roster-folders/${editingFolderId}/`, payload);
        setActionMessage('グループを更新しました');
      } else {
        await apiPost('/api/roster-folders/', payload);
        setActionMessage('グループを作成しました');
      }
      setShowFolderModal(false);
      resetFolderForm();
      fetchFolders();
    } catch (err) {
      console.error(err);
      setActionMessage('グループの保存に失敗しました');
    }
  };

  const deleteFolder = async (folderId: string) => {
    if (!window.confirm('このグループを削除しますか？メンバー設定も解除されます。')) return;
    try {
      await apiDelete(`/api/roster-folders/${folderId}/`);
      setActionMessage('グループを削除しました');
      if (selectedFolderId === folderId) setSelectedFolderId(null);
      fetchFolders();
    } catch (err) {
      console.error(err);
      setActionMessage('グループの削除に失敗しました');
    }
  };

  const openMemberModal = () => {
    setMemberSelection({});
    setMemberSearch('');
    setMemberNote('');
    setShowMemberModal(true);
  };

  const availableStudents: MemberSelection[] = useMemo(() => {
    const existing = new Set(members.map((m) => m.student_teacher_link_id));
    const keyword = memberSearch.trim().toLowerCase();
    return students
      .filter((s) => !existing.has(s.student_teacher_link_id))
      .filter((s) => !keyword || s.display_name.toLowerCase().includes(keyword))
      .map((s) => ({ id: s.student_teacher_link_id, display_name: s.display_name, status: s.status }));
  }, [students, members, memberSearch]);

  const toggleSelection = (id: string) => {
    setMemberSelection((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const addMembers = async () => {
    if (!selectedFolderId) return;
    const ids = Object.keys(memberSelection).filter((k) => memberSelection[k]);
    if (!ids.length) return;
    setActionMessage(null);
    try {
      await Promise.all(
        ids.map((student_teacher_link_id) =>
          apiPost('/api/roster-memberships/', {
            roster_folder_id: selectedFolderId,
            student_teacher_link_id,
            note: memberNote || null,
          }),
        ),
      );
      setActionMessage('メンバーを追加しました');
      setShowMemberModal(false);
      setMemberSelection({});
      fetchMembers(selectedFolderId);
      fetchFolders();
    } catch (err) {
      console.error(err);
      setActionMessage('メンバー追加に失敗しました');
    }
  };

  const removeMember = async (membershipId: string) => {
    if (!window.confirm('この生徒をグループから外しますか？')) return;
    try {
      await apiDelete(`/api/roster-memberships/${membershipId}/`);
      setMembers((prev) => prev.filter((m) => m.roster_membership_id !== membershipId));
      setActionMessage('メンバーを削除しました');
      fetchFolders();
    } catch (err) {
      console.error(err);
      setActionMessage('メンバー削除に失敗しました');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-12 w-12 rounded-full border-b-2 border-indigo-600" />
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
        <p className="text-slate-700">左でフォルダを選び、右でメンバーを管理するプレイリスト型 UI です。</p>
      </header>

      {actionMessage && <p className="text-sm text-slate-700">{actionMessage}</p>}

      <div className="grid md:grid-cols-[minmax(260px,320px)_1fr] gap-6">
        <div className="bg-white shadow rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">グループ一覧</h2>
            <button
              type="button"
              onClick={openCreateFolder}
              className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
            >
              + グループ追加
            </button>
          </div>
          <ul className="space-y-1 max-h-[720px] overflow-y-auto">
            {availableFolders.map((folder) => {
              const isSelected = folder.roster_folder_id === selectedFolderId;
              return (
                <li
                  key={folder.roster_folder_id}
                      className={`flex items-center justify-between rounded-md text-sm cursor-pointer border ${
                    isSelected
                      ? 'bg-indigo-50 text-indigo-800 border-indigo-200 border-l-4 border-indigo-500'
                      : 'bg-white text-slate-700 border-transparent hover:bg-slate-50'
                  }`}
                  onClick={() => setSelectedFolderId(folder.roster_folder_id)}
                  style={{ paddingLeft: 8 + folder.depth * 16 }}
                >
                  <div className="flex items-center gap-3 py-2 pr-2 w-full">
                    <span className="font-semibold truncate">{folder.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{folder.member_count}人</span>
                  </div>
                  <div className="flex items-center gap-1 pr-2 text-xs">
                    <button
                      type="button"
                      className="px-2 py-1 rounded border border-slate-200 text-slate-700 hover:bg-slate-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditFolder(folder);
                      }}
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 rounded border border-slate-200 text-slate-700 hover:bg-slate-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFolder(folder.roster_folder_id);
                      }}
                    >
                      削除
                    </button>
                  </div>
                </li>
              );
            })}
            {availableFolders.length === 0 && (
              <li className="text-sm text-slate-500 px-2 py-3">グループはまだありません。右上の「＋ グループ追加」から作成してください。</li>
            )}
          </ul>
        </div>

        <div className="bg-white shadow rounded-lg p-4 space-y-4">
          {!selectedFolder ? (
            <p className="text-sm text-slate-600">左の一覧からグループを選択してください。</p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{selectedFolder.name}</h2>
                  <p className="text-sm text-slate-600">{selectedFolder.member_count}人 が所属しています。</p>
                  {selectedFolder.notes && <p className="text-sm text-slate-700 mt-1">{selectedFolder.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
                    onClick={openMemberModal}
                  >
                    + 生徒を追加
                  </button>
                </div>
              </div>

              <div className="border rounded-lg border-slate-200 divide-y divide-slate-100">
                {members.map((m) => (
                  <div key={m.roster_membership_id} className="flex items-center justify-between px-3 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {m.avatar_url ? (
                        <img src={m.avatar_url} alt={m.display_name} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-semibold">
                          {(m.display_name || 'S').slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{m.display_name}</p>
                        <p className="text-xs text-slate-600">{m.status}</p>
                        <div className="flex flex-wrap gap-2 mt-1 text-xs text-slate-700">
                          {m.local_student_code && <span className="px-2 py-0.5 rounded bg-slate-100">{m.local_student_code}</span>}
                          {(m.tags || []).map((t) => (
                            <span key={t} className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800">
                              {t}
                            </span>
                          ))}
                          {m.note && <span className="text-slate-600">{m.note}</span>}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="px-3 py-1 rounded border border-slate-300 text-slate-700 text-xs hover:bg-slate-50"
                      onClick={() => removeMember(m.roster_membership_id)}
                    >
                      解除
                    </button>
                  </div>
                ))}
                {members.length === 0 && (
                  <div className="px-3 py-4 text-sm text-slate-500">まだメンバーがいません。右上の「＋ 生徒を追加」から登録してください。</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {showFolderModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40 px-4">
          <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">{editingFolderId ? 'グループ編集' : 'グループ追加'}</h3>
              <button
                type="button"
                onClick={() => setShowFolderModal(false)}
                className="text-slate-600 hover:text-slate-800 text-sm"
              >
                閉じる
              </button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-800">グループ名</label>
                <input
                  value={folderForm.name}
                  onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm text-slate-900"
                  placeholder="例: A中学 1年1組"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-800">メモ</label>
                <input
                  value={folderForm.notes}
                  onChange={(e) => setFolderForm({ ...folderForm, notes: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm text-slate-900"
                  placeholder="任意"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-800">並び順</label>
                  <input
                    type="number"
                    value={folderForm.sort_order}
                    onChange={(e) => setFolderForm({ ...folderForm, sort_order: e.target.value })}
                    className="w-full border rounded-md px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-800">親グループ（任意）</label>
                  <select
                    value={folderForm.parent_folder_id}
                    onChange={(e) => setFolderForm({ ...folderForm, parent_folder_id: e.target.value })}
                    className="w-full border rounded-md px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="">ルート（なし）</option>
                    {availableFolders.map((f) => (
                      <option key={f.roster_folder_id} value={f.roster_folder_id}>
                        {'- '.repeat(f.depth)}
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowFolderModal(false)}
                className="px-4 py-2 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={saveFolder}
                className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {showMemberModal && selectedFolder && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40 px-4">
          <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{selectedFolder.name} に生徒を追加</h3>
                <p className="text-xs text-slate-600">リンク済みの生徒から選択します。複数選択も可能です。</p>
              </div>
              <button
                type="button"
                onClick={() => setShowMemberModal(false)}
                className="text-slate-600 hover:text-slate-800 text-sm"
              >
                閉じる
              </button>
            </div>

            <div className="flex flex-col md:flex-row md:items-end gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-xs font-medium text-slate-800">検索（表示名）</label>
                <input
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm text-slate-900"
                  placeholder="氏名で絞り込み"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-800">共通メモ（任意）</label>
                <input
                  value={memberNote}
                  onChange={(e) => setMemberNote(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm text-slate-900"
                  placeholder="追加時に付与するメモ"
                />
              </div>
            </div>

            <div className="border rounded-lg border-slate-200 max-h-[420px] overflow-y-auto divide-y divide-slate-100">
              {availableStudents.map((s) => (
                <label key={s.id} className="flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!memberSelection[s.id]}
                      onChange={() => toggleSelection(s.id)}
                      className="h-4 w-4"
                    />
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900">{s.display_name}</span>
                      <span className="text-xs text-slate-600">{s.status}</span>
                    </div>
                  </div>
                </label>
              ))}
              {availableStudents.length === 0 && (
                <div className="px-3 py-4 text-sm text-slate-500">追加できる生徒が見つかりません。</div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowMemberModal(false)}
                className="px-4 py-2 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={addMembers}
                className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
              >
                選択した生徒を追加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
