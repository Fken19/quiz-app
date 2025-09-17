'use client';

import { useSession, signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { TeacherGroupsAPI } from '@/lib/api-utils';
import type { GroupMembershipItem, TeacherGroup, MinimalUser } from '@/types/quiz';
// Chart.js (軽量描画)
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend);

interface StudentRow {
  id: string;
  user_id: string;
  display_name: string;
  joined_at: string;
  avatar_url?: string;
  attr1?: string;
  attr2?: string;
  // 追加の統計値は別途APIから取得予定
  quiz_count?: number;
  average_score?: number;
  last_activity?: string;
}

export default function GroupDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;
  
  const [group, setGroup] = useState<TeacherGroup | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active'|'pending'|'all'>('active');
  const [candidates, setCandidates] = useState<MinimalUser[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingName, setEditingName] = useState<string>('');
  const [savingName, setSavingName] = useState<boolean>(false);
  const [attrEditing, setAttrEditing] = useState<{[mid:string]: {attr1: string; attr2: string}}>({});
  const [ranking, setRanking] = useState<{period: 'daily'|'weekly'|'monthly'; metric: 'answers'|'accuracy'; items: Array<{user: {id:string; display_name:string; avatar_url?:string}; value:number}>}>({period:'weekly', metric:'answers', items: []});
  const [rankLoading, setRankLoading] = useState(false);
  const [filterAttr1, setFilterAttr1] = useState('');
  const [filterAttr2, setFilterAttr2] = useState('');
  const [dashboard, setDashboard] = useState<any | null>(null);
  const [dashLoading, setDashLoading] = useState(false);
  // 空値フィルタ用の内部トークン
  const EMPTY = '__EMPTY__';

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
  // グループ詳細
  const found: TeacherGroup | null = await TeacherGroupsAPI.get(String(groupId));
  if (!found || !found.id) {
        setError('グループが見つかりません');
        return;
      }
  setGroup(found);
  setEditingName(found.name);

  // メンバー一覧（将来的にフィルタを反映する場合は membersFiltered を利用）
  const res = await TeacherGroupsAPI.members(String(groupId));
      const members: GroupMembershipItem[] = res?.members ?? [];
      const rows: StudentRow[] = members.map((m) => ({
        id: m.id,
        user_id: m.user.id,
        display_name: m.effective_name || m.user.display_name || '生徒',
        joined_at: m.created_at,
        avatar_url: m.user.avatar_url,
        attr1: m.attr1,
        attr2: m.attr2,
      }));
      setStudents(rows);
  await fetchRanking('weekly','answers');
  await fetchDashboard();
    } catch (err) {
      console.error('Failed to fetch group details:', err);
      setError('グループ詳細の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const fetchRanking = async (period: 'daily'|'weekly'|'monthly', metric: 'answers'|'accuracy') => {
    setRankLoading(true);
    try {
      const res = await TeacherGroupsAPI.rankings(String(groupId), { period, metric });
      const items = (res?.rankings ?? []).map((r:any) => ({ user: r.user, value: r.value }));
      setRanking({ period, metric, items });
    } catch (e) {
      // noop
    } finally {
      setRankLoading(false);
    }
  };

  const fetchDashboard = async () => {
    setDashLoading(true);
    try {
      const res = await TeacherGroupsAPI.dashboard(String(groupId), { days: 30 });
      setDashboard(res || null);
    } catch (_) {
      // noop
    } finally {
      setDashLoading(false);
    }
  };

  const fetchMembersWithFilters = async (overrides?: { attr1?: string; attr2?: string }) => {
    try {
      const effAttr1 = overrides?.attr1 ?? filterAttr1;
      const effAttr2 = overrides?.attr2 ?? filterAttr2;
      const res = await TeacherGroupsAPI.membersFiltered(String(groupId), {
        attr1: effAttr1 && effAttr1 !== EMPTY ? effAttr1 : undefined,
        attr2: effAttr2 && effAttr2 !== EMPTY ? effAttr2 : undefined,
        order: 'name',
      });
      const members: GroupMembershipItem[] = res?.members ?? [];
      const rows: StudentRow[] = members.map((m) => ({
        id: m.id,
        user_id: m.user.id,
        display_name: m.effective_name || m.user.display_name || '生徒',
        joined_at: m.created_at,
        avatar_url: m.user.avatar_url,
        attr1: m.attr1,
        attr2: m.attr2,
      }));
      setStudents(rows);
    } catch (_) {}
  };

  const clearFilters = async () => {
    setFilterAttr1('');
    setFilterAttr2('');
    // サーバのデフォルトリストを再取得
    try {
      const res = await TeacherGroupsAPI.members(String(groupId));
      const members: GroupMembershipItem[] = res?.members ?? [];
      const rows: StudentRow[] = members.map((m) => ({
        id: m.id,
        user_id: m.user.id,
        display_name: m.effective_name || m.user.display_name || '生徒',
        joined_at: m.created_at,
        avatar_url: m.user.avatar_url,
        attr1: m.attr1,
        attr2: m.attr2,
      }));
      setStudents(rows);
    } catch {}
  };

  // 属性内訳からのワンクリック絞り込み
  const handleAttr1Click = async (value: string) => {
    const v = value || EMPTY;
    setFilterAttr1(v);
    await fetchMembersWithFilters({ attr1: v });
    // スクロールして生徒表にフォーカス
    try { document.getElementById('members-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
  };
  const handleAttr2Click = async (value: string) => {
    const v = value || EMPTY;
    setFilterAttr2(v);
    await fetchMembersWithFilters({ attr2: v });
    try { document.getElementById('members-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
  };

  const handleSaveName = async () => {
    if (!group) return;
    const name = editingName.trim();
    if (!name || name === group.name) return;
    try {
      setSavingName(true);
      const updated = await TeacherGroupsAPI.update(String(group.id), name);
      setGroup((prev) => (prev ? { ...prev, name: updated.name } : prev));
    } catch (e) {
      setError('グループ名の更新に失敗しました');
    } finally {
      setSavingName(false);
    }
  };

  // CSVエクスポートは不要のため削除

  const handleSearch = async () => {
    setSearching(true);
    setError(null);
    try {
      const res = await TeacherGroupsAPI.searchCandidates(String(groupId), { q: searchQ, status: statusFilter });
  const list: MinimalUser[] = res?.candidates ?? [];
      setCandidates(list);
      // 既選択は維持
    } catch (e) {
      setError('候補の検索に失敗しました');
    } finally {
      setSearching(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddSelected = async () => {
    if (selectedIds.size === 0) return;
    setAdding(true);
    setError(null);
    try {
      await TeacherGroupsAPI.addMembersByIds(String(groupId), Array.from(selectedIds));
      // Refresh members
      const res = await TeacherGroupsAPI.members(String(groupId));
      const members: GroupMembershipItem[] = res?.members ?? [];
      const rows: StudentRow[] = members.map((m) => ({
        id: m.id,
        user_id: m.user.id,
        display_name: m.effective_name || m.user.display_name || '生徒',
        joined_at: m.created_at,
        avatar_url: m.user.avatar_url,
        attr1: m.attr1,
        attr2: m.attr2,
      }));
      setStudents(rows);
      // Close modal and reset
      setShowAddModal(false);
      setCandidates([]);
      setSelectedIds(new Set());
      setSearchQ('');
    } catch (e) {
      setError('生徒の追加に失敗しました');
    } finally {
      setAdding(false);
    }
  };

  const startEditAttr = (memberId: string, init1?: string, init2?: string) => {
    setAttrEditing((prev) => ({...prev, [memberId]: {attr1: init1 || '', attr2: init2 || ''}}));
  };
  const cancelEditAttr = (memberId: string) => {
    setAttrEditing((prev) => { const n={...prev}; delete n[memberId]; return n; });
  };
  const saveAttr = async (memberId: string) => {
    const payload = attrEditing[memberId];
    if (!payload) return;
    try {
      const updated = await TeacherGroupsAPI.updateMemberAttributes(String(groupId), memberId, payload);
      setStudents((prev) => prev.map(s => s.id === memberId ? { ...s, attr1: updated.attr1, attr2: updated.attr2 } : s));
      cancelEditAttr(memberId);
    } catch (e) {
      setError('属性の更新に失敗しました');
    }
  };

  const handleRemoveStudent = async (memberId: string) => {
    if (!confirm('この生徒をグループから削除しますか？')) return;

    try {
      await TeacherGroupsAPI.removeMember(String(groupId), memberId);
      setStudents((prev) => prev.filter(student => student.id !== memberId));
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
                src={session.user?.image || "/vercel.svg"}
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
                  <dd className="mt-1 text-sm text-gray-900 flex items-center space-x-2">
                    <input
                      className="border px-2 py-1 rounded w-full max-w-xs"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={savingName || !editingName.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white px-3 py-1 rounded text-sm"
                    >保存</button>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">作成日</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(group.created_at).toLocaleDateString('ja-JP')}
                  </dd>
                </div>
                {/* CSVエクスポートは非対応（プライバシーポリシー） */}
                {/* 追加の説明などは今後拡張 */}
                <div>
                  <dt className="text-sm font-medium text-gray-500">生徒数</dt>
                  <dd className="mt-1 text-sm text-gray-900">{students.length}名</dd>
                </div>
                {/* 作成者表示は省略（API未提供） */}
              </dl>
            </div>
          </div>

          {/* 生徒管理 */}
          <div id="members-section" className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900">グループ情報</h3>
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
            <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3">
              <div className="text-sm text-gray-700">フィルタ:</div>
              <input value={filterAttr1 === EMPTY ? '未設定(クリック適用)' : filterAttr1} onChange={e=>setFilterAttr1(e.target.value)} placeholder="属性1" className="border rounded px-2 py-1 text-sm" />
              <input value={filterAttr2 === EMPTY ? '未設定(クリック適用)' : filterAttr2} onChange={e=>setFilterAttr2(e.target.value)} placeholder="属性2" className="border rounded px-2 py-1 text-sm" />
              <button onClick={() => fetchMembersWithFilters()} className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded">適用</button>
              <button onClick={clearFilters} className="text-sm bg-white border px-3 py-1 rounded">クリア</button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      生徒
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">属性1</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">属性2</th>
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
                  {students
                    .filter(s => (filterAttr1 ? (filterAttr1 === EMPTY ? !(s.attr1 && s.attr1.length) : (s.attr1||'').includes(filterAttr1)) : true))
                    .filter(s => (filterAttr2 ? (filterAttr2 === EMPTY ? !(s.attr2 && s.attr2.length) : (s.attr2||'').includes(filterAttr2)) : true))
                    .map((student) => {
                    const editing = attrEditing[student.id];
                    return (
                    <tr key={student.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/admin-dashboard/students/${student.user_id}`)}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <img src={student.avatar_url || '/vercel.svg'} alt="avatar" className="w-8 h-8 rounded-full mr-3 border" />
                          <div className="text-sm font-medium text-gray-900">{student.display_name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {editing ? (
                          <input value={editing.attr1} onChange={e=>setAttrEditing(p=>({...p, [student.id]: {...p[student.id], attr1: e.target.value}}))} className="border rounded px-2 py-1" />
                        ) : (
                          student.attr1 || '—'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {editing ? (
                          <input value={editing.attr2} onChange={e=>setAttrEditing(p=>({...p, [student.id]: {...p[student.id], attr2: e.target.value}}))} className="border rounded px-2 py-1" />
                        ) : (
                          student.attr2 || '—'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.quiz_count ?? '—'} 回
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.average_score ? `${student.average_score.toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {student.last_activity ? new Date(student.last_activity).toLocaleDateString('ja-JP') : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {student.joined_at ? new Date(student.joined_at).toLocaleDateString('ja-JP') : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {editing ? (
                          <>
                            <button onClick={()=>saveAttr(student.id)} className="text-indigo-600 hover:text-indigo-900 mr-4">保存</button>
                            <button onClick={()=>cancelEditAttr(student.id)} className="text-gray-600 hover:text-gray-900 mr-4">取消</button>
                          </>
                        ) : (
                          <button onClick={()=>startEditAttr(student.id, student.attr1, student.attr2)} className="text-indigo-600 hover:text-indigo-900 mr-4">属性編集</button>
                        )}
                        <button
                          onClick={() => handleRemoveStudent(student.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  )})}
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

      {/* ランキングとフィルタ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white shadow sm:rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">学習量ランキング</h3>
            <div className="flex items-center space-x-2">
              <select value={ranking.period} onChange={e=>fetchRanking(e.target.value as any, ranking.metric)} className="border rounded px-2 py-1 text-sm">
                <option value="daily">日</option>
                <option value="weekly">週</option>
                <option value="monthly">月</option>
              </select>
              <select value={ranking.metric} onChange={e=>fetchRanking(ranking.period, e.target.value as any)} className="border rounded px-2 py-1 text-sm">
                <option value="answers">学習量（回答数）</option>
                <option value="accuracy">正答率</option>
              </select>
            </div>
          </div>
          {rankLoading ? (
            <div className="py-6 text-center"><LoadingSpinner size="small" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">順位</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">生徒</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{ranking.metric==='answers' ? '回答数' : '正答率'}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {ranking.items.map((r, idx) => (
                    <tr key={r.user.id}>
                      <td className="px-4 py-2 text-sm text-gray-700">{idx+1}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center">
                          <img src={r.user.avatar_url || '/vercel.svg'} className="w-8 h-8 rounded-full mr-3 border" />
                          <span className="text-sm text-gray-900">{r.user.display_name || '生徒'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right text-sm font-semibold">{ranking.metric==='answers' ? `${r.value} 回` : `${r.value.toFixed(1)}%`}</td>
                    </tr>
                  ))}
                  {ranking.items.length === 0 && (
                    <tr><td colSpan={3} className="py-6 text-center text-gray-500">データがありません</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* グループダッシュボード */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white shadow sm:rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">グループ全体の学習状況</h3>
            <button onClick={fetchDashboard} className="text-sm text-indigo-600 hover:text-indigo-800">更新</button>
          </div>
          {dashLoading ? (
            <div className="py-6 text-center"><LoadingSpinner size="small" /></div>
          ) : dashboard ? (
            <div className="space-y-6">
              {/* サマリーカード */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded p-4">
                  <div className="text-sm text-gray-500">メンバー数</div>
                  <div className="text-2xl font-semibold">{dashboard.members_count}</div>
                </div>
                <div className="bg-gray-50 rounded p-4">
                  <div className="text-sm text-gray-500">期間内合計回答</div>
                  <div className="text-2xl font-semibold">{dashboard.totals?.total_answers ?? 0}</div>
                </div>
                <div className="bg-gray-50 rounded p-4">
                  <div className="text-sm text-gray-500">正答数</div>
                  <div className="text-2xl font-semibold">{dashboard.totals?.correct_answers ?? 0}</div>
                </div>
                <div className="bg-gray-50 rounded p-4">
                  <div className="text-sm text-gray-500">正答率</div>
                  <div className="text-2xl font-semibold">{dashboard.totals ? (dashboard.totals.accuracy_pct).toFixed(1) : '0.0'}%</div>
                </div>
              </div>

              {/* 日別推移（ライン） */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">日別推移（回答/正答）</h4>
                {Array.isArray(dashboard.daily) && dashboard.daily.length > 0 ? (
                  <div className="w-full h-64">
                    <Line
                      data={{
                        labels: dashboard.daily.map((d: any) => d.date),
                        datasets: [
                          {
                            label: '回答',
                            data: dashboard.daily.map((d: any) => d.total),
                            borderColor: 'rgba(99, 102, 241, 1)',
                            backgroundColor: 'rgba(99, 102, 241, 0.2)',
                            tension: 0.2,
                          },
                          {
                            label: '正答',
                            data: dashboard.daily.map((d: any) => d.correct),
                            borderColor: 'rgba(16, 185, 129, 1)',
                            backgroundColor: 'rgba(16, 185, 129, 0.2)',
                            tension: 0.2,
                          },
                        ],
                      }}
                      options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }}
                    />
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">日別データがありません</div>
                )}
              </div>

              {/* 分布（回答数/正答率） */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">学習量の分布（生徒あたり回答数）</h4>
                  {Array.isArray(dashboard.distributions?.answers_per_student) && dashboard.distributions.answers_per_student.length > 0 ? (
                    <div className="w-full h-64">
                      <Bar
                        data={{
                          labels: dashboard.distributions.answers_per_student.map((b: any) => b.bin),
                          datasets: [
                            {
                              label: '人数',
                              data: dashboard.distributions.answers_per_student.map((b: any) => b.count),
                              backgroundColor: 'rgba(99, 102, 241, 0.6)',
                            },
                          ],
                        }}
                        options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                      />
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">分布データがありません</div>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">正答率の分布（生徒あたり）</h4>
                  {Array.isArray(dashboard.distributions?.accuracy_per_student) && dashboard.distributions.accuracy_per_student.length > 0 ? (
                    <div className="w-full h-64">
                      <Bar
                        data={{
                          labels: dashboard.distributions.accuracy_per_student.map((b: any) => `${b.bin}%`),
                          datasets: [
                            {
                              label: '人数',
                              data: dashboard.distributions.accuracy_per_student.map((b: any) => b.count),
                              backgroundColor: 'rgba(16, 185, 129, 0.6)',
                            },
                          ],
                        }}
                        options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                      />
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">分布データがありません</div>
                  )}
                </div>
              </div>

              {/* 属性内訳 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">属性1の内訳</h4>
                  <ul className="divide-y">
                    {(dashboard.attr1_breakdown || []).map((r: any, idx: number) => (
                      <li key={idx} className="py-1 flex justify-between items-center">
                        <button
                          className="text-left text-sm text-indigo-600 hover:underline truncate"
                          title={`${r.value || '未設定'} を絞り込み`}
                          onClick={() => handleAttr1Click(r.value || '')}
                        >{r.value || '未設定'}</button>
                        <span className="text-sm text-gray-500">{r.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">属性2の内訳</h4>
                  <ul className="divide-y">
                    {(dashboard.attr2_breakdown || []).map((r: any, idx: number) => (
                      <li key={idx} className="py-1 flex justify-between items-center">
                        <button
                          className="text-left text-sm text-indigo-600 hover:underline truncate"
                          title={`${r.value || '未設定'} を絞り込み`}
                          onClick={() => handleAttr2Click(r.value || '')}
                        >{r.value || '未設定'}</button>
                        <span className="text-sm text-gray-500">{r.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">データがありません</div>
          )}
        </div>
      </section>

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
                  <label className="block text-sm font-medium text-gray-700 mb-1">検索</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={searchQ}
                      onChange={(e) => setSearchQ(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="氏名/ユーザー名/ID"
                    />
                    <select
                      className="px-2 py-2 border border-gray-300 rounded-md"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                    >
                      <option value="active">有効</option>
                      <option value="pending">承認待ち</option>
                      <option value="all">すべて</option>
                    </select>
                    <button
                      onClick={handleSearch}
                      disabled={searching}
                      className="bg-gray-100 hover:bg-gray-200 px-3 rounded text-sm"
                    >{searching ? '検索中…' : '検索'}</button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">あなたと紐付いた生徒から検索します。</p>
                </div>

                {/* 候補一覧 */}
                {candidates.length > 0 && (
                  <div className="max-h-60 overflow-auto border rounded">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-3 py-2 text-left">選択</th>
                          <th className="px-3 py-2 text-left">氏名</th>
                        </tr>
                      </thead>
                      <tbody>
                        {candidates.map((u) => (
                          <tr key={u.id} className="border-t">
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(u.id)}
                                onChange={() => toggleSelect(u.id)}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center">
                                <img src={u.avatar_url || '/vercel.svg'} alt="avatar" className="w-6 h-6 rounded-full mr-2 border" />
                                <div className="font-medium">{u.display_name || '生徒'}</div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={handleAddSelected}
                  disabled={selectedIds.size === 0 || adding}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  追加
                </button>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setCandidates([]);
                    setSelectedIds(new Set());
                    setSearchQ('');
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
