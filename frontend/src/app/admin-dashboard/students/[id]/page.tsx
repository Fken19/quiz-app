'use client';

import { useSession, signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { apiGet, apiPost, TeacherStudentDetailAPI, TeacherAliasesAPI, TeacherGroupsAPI } from '@/lib/api-utils';
import { normalizeAvatarUrl } from '@/lib/avatar';

interface Student {
  id: string;
  email: string;
  display_name: string;
  groups: string[];
  total_quiz_count: number;
  average_score: number;
  last_activity: string;
  joined_at: string;
  total_questions_answered: number;
  correct_answers: number;
}

interface QuizSession {
  id: string;
  quiz_name: string;
  group: string;
  score: number;
  total_questions: number;
  correct_answers: number;
  completed_at: string;
  time_taken: number;
}

export default function StudentDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const studentId = params.id as string;
  
  const [student, setStudent] = useState<Student | null>(null);
  const [quizSessions, setQuizSessions] = useState<QuizSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [alias, setAlias] = useState<{ id?: string; alias_name?: string; note?: string } | null>(null);
  const [aliasDraft, setAliasDraft] = useState<{ alias_name: string; note: string }>({ alias_name: '', note: '' });
  const [memberships, setMemberships] = useState<Array<{ id: string; group_id: string; group_name: string; attr1: string; attr2: string; created_at: string }>>([]);
  const [metrics, setMetrics] = useState<{ summary: any; daily: any[]; weekly: any[]; monthly: any[] } | null>(null);
  const [history, setHistory] = useState<{ results: any[]; page: number; page_size: number; total: number } | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [historyLevel, setHistoryLevel] = useState<string>('');
  const [historySince, setHistorySince] = useState<string>('');
  const [historyUntil, setHistoryUntil] = useState<string>('');
  const [historyOrder, setHistoryOrder] = useState<'created_at_desc' | 'created_at_asc'>('created_at_desc');

  // ソート変更時に自動再読込
  useEffect(() => {
    if (status === 'authenticated') {
      fetchHistory(1, historyPageSize, historyLevel, historySince, historyUntil);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyOrder]);

  useEffect(() => {
    if (status === "unauthenticated") {
      signIn("google");
      return;
    }
    if (status === "authenticated") {
      (async () => {
        try {
          const data = await apiGet('/user/profile/');
          const p = data?.user || data;
          p.avatar_url = normalizeAvatarUrl(p?.avatar_url || p?.avatar) || null;
          setProfile(p);
        } catch (_) {}
      })();
      fetchStudentDetails();
    }
  }, [status, studentId]);

  const fetchStudentDetails = async () => {
    try {
      const res = await TeacherStudentDetailAPI.getByStudent(String(studentId));
      if (!res || !res.student) {
        setError('生徒が見つかりません');
        return;
      }
      const s = res.student;
      const groups = (res.groups || []).map((g: any) => g.name);
      // 概要統計
      const stats = res.stats_30d || { total_answers: 0, correct_answers: 0 };
      const avg = stats.total_answers ? (stats.correct_answers / stats.total_answers) * 100 : 0;
      const lastAct = (res.daily || []).slice(-1)[0]?.date || new Date().toISOString();
      const joinedAt = (groups.length > 0) ? new Date().toISOString() : new Date().toISOString();
      setStudent({
        id: s.id,
        email: '', // プライバシー保護のため表示しない
        display_name: s.display_name,
        groups,
        total_quiz_count: stats.total_answers,
        average_score: avg,
        last_activity: lastAct,
        joined_at: joinedAt,
        total_questions_answered: stats.total_answers,
        correct_answers: stats.correct_answers,
      });

      // エイリアス
      if (res.alias) {
        setAlias({ id: res.alias.id, alias_name: res.alias.alias_name, note: res.alias.note || '' });
        setAliasDraft({ alias_name: res.alias.alias_name || '', note: res.alias.note || '' });
      } else {
        setAlias(null);
        setAliasDraft({ alias_name: '', note: '' });
      }
      // 所属グループ
      try {
        const mem = await apiGet(`/teacher/student-detail/by-student/${studentId}/memberships/`);
        setMemberships(mem?.memberships || []);
      } catch (_) {}
      // メトリクス
      try {
        const m = await apiGet(`/teacher/student-detail/by-student/${studentId}/metrics/`);
        setMetrics(m);
      } catch (_) {}
      // 履歴（ページングAPI）初期ロード
      await fetchHistory(1, historyPageSize, historyLevel, historySince, historyUntil, false);
    } catch (err) {
      console.error('Failed to fetch student details:', err);
      setError('生徒詳細の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (
    page: number,
    pageSize: number,
    level: string,
    since: string,
    until: string,
    setPageState: boolean = true,
  ) => {
    const usp = new URLSearchParams();
    usp.set('page', String(page));
    usp.set('page_size', String(pageSize));
    if (level) usp.set('level', level);
    if (since) usp.set('since', since);
    if (until) usp.set('until', until);
  if (historyOrder) usp.set('order', historyOrder);
    const data = await apiGet(`/teacher/student-detail/by-student/${studentId}/history/?${usp.toString()}`);
    setHistory(data);
    if (setPageState) setHistoryPage(page);
  };

  const saveAlias = async () => {
    try {
      await TeacherAliasesAPI.upsert(String(studentId), aliasDraft.alias_name, aliasDraft.note);
      setAlias({ alias_name: aliasDraft.alias_name, note: aliasDraft.note });
      alert('エイリアスを保存しました');
    } catch (e: any) {
      alert(`保存に失敗しました: ${e?.message || e}`);
    }
  };

  const updateMembershipAttr = async (groupId: string, memberId: string, attrs: { attr1?: string; attr2?: string }) => {
    try {
      await TeacherGroupsAPI.updateMemberAttributes(groupId, memberId, attrs);
      // refresh memberships list
      const mem = await apiGet(`/teacher/student-detail/by-student/${studentId}/memberships/`);
      setMemberships(mem?.memberships || []);
    } catch (e: any) {
      alert(`属性更新に失敗しました: ${e?.message || e}`);
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!session || !student) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            生徒が見つかりません
          </h2>
          <Link
            href="/admin-dashboard/students"
            className="text-indigo-600 hover:text-indigo-800"
          >
            生徒一覧に戻る
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
              <Link href="/admin-dashboard/students" className="text-gray-600 hover:text-gray-900">
                生徒管理
              </Link>
              <span className="text-indigo-600 font-medium">
                {student.display_name}
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">{profile?.display_name || session.user?.name}</span>
              <img
                src={profile?.avatar_url || session.user?.image || "/default-avatar.png"}
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

          {/* 生徒基本情報 + エイリアス/メモ（講師専用） */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                生徒詳細
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                学習履歴と成績情報
              </p>
            </div>
            
            <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">表示名</dt>
                  <dd className="mt-1 text-sm text-gray-900">{student.display_name}</dd>
                </div>
                {/* プライバシー保護のためメールは表示しない */}
                <div>
                  <dt className="text-sm font-medium text-gray-500">参加日</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(student.joined_at).toLocaleDateString('ja-JP')}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">最終活動</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(student.last_activity).toLocaleDateString('ja-JP')}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">所属グループ</dt>
                  <dd className="mt-1">
                    <div className="flex flex-wrap gap-2">
                      {student.groups.map((group, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {group}
                        </span>
                      ))}
                    </div>
                  </dd>
                </div>
              </dl>
              {/* エイリアス編集 */}
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-900 mb-2">講師専用メモ・エイリアス（この講師にのみ表示）</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1">
                    <label className="block text-sm text-gray-600 mb-1">呼び名（エイリアス）</label>
                    <input
                      value={aliasDraft.alias_name}
                      onChange={(e) => setAliasDraft(a => ({ ...a, alias_name: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-md text-gray-900"
                      placeholder="例: けんちゃん"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-600 mb-1">メモ</label>
                    <input
                      value={aliasDraft.note}
                      onChange={(e) => setAliasDraft(a => ({ ...a, note: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-md text-gray-900"
                      placeholder="特徴や注意点など（本人画面には表示されません）"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <button onClick={saveAlias} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                    保存
                  </button>
                </div>
              </div>
              {/* 所属グループ詳細 */}
              <div className="mt-8">
                <h4 className="text-sm font-medium text-gray-900 mb-2">所属グループ（あなたの管理）</h4>
                {memberships.length === 0 ? (
                  <p className="text-sm text-gray-600">所属しているグループはありません。</p>
                ) : (
                  <ul className="space-y-2">
                    {memberships.map(m => (
                      <li key={m.id} className="p-3 border rounded-md">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{m.group_name}</div>
                            <div className="text-xs text-gray-600">参加: {new Date(m.created_at).toLocaleDateString('ja-JP')}</div>
                          </div>
                          <a href={`/admin-dashboard/groups/${m.group_id}`} className="text-indigo-600 text-sm hover:underline">グループを見る</a>
                        </div>
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">属性1</label>
                            <div className="flex gap-2">
                              <input defaultValue={m.attr1 || ''} id={`attr1-${m.id}`} className="flex-1 px-2 py-1 border rounded text-gray-900" />
                              <button onClick={() => {
                                const v = (document.getElementById(`attr1-${m.id}`) as HTMLInputElement)?.value || '';
                                updateMembershipAttr(m.group_id, m.id, { attr1: v });
                              }} className="px-3 py-1 text-sm bg-gray-100 text-gray-800 rounded hover:bg-gray-200">保存</button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">属性2</label>
                            <div className="flex gap-2">
                              <input defaultValue={m.attr2 || ''} id={`attr2-${m.id}`} className="flex-1 px-2 py-1 border rounded text-gray-900" />
                              <button onClick={() => {
                                const v = (document.getElementById(`attr2-${m.id}`) as HTMLInputElement)?.value || '';
                                updateMembershipAttr(m.group_id, m.id, { attr2: v });
                              }} className="px-3 py-1 text-sm bg-gray-100 text-gray-800 rounded hover:bg-gray-200">保存</button>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* 学習統計 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">📊</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        クイズ回数
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {student.total_quiz_count} 回
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
                      <span className="text-white font-bold text-sm">📈</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        平均スコア
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {student.average_score.toFixed(1)}%
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
                      <span className="text-white font-bold text-sm">❓</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        総問題数
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {student.total_questions_answered} 問
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
                      <span className="text-white font-bold text-sm">✅</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        正答数
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {student.correct_answers} 問
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 期間別サマリー（今日/週/月/全体） */}
          {metrics && (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg leading-6 font-medium text-gray-900">期間別サマリー</h3>
              </div>
              <div className="px-4 py-5 sm:p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {(['today','week','month','all'] as const).map((k) => (
                    <div key={k} className="border rounded-md p-4">
                      <div className="text-sm text-gray-500 mb-1">
                        {k === 'today' ? '今日' : k === 'week' ? '直近7日' : k === 'month' ? '今月' : '全期間'}
                      </div>
                      <div className="text-sm text-gray-900">問題数: {metrics.summary?.[k]?.total_questions ?? 0}</div>
                      <div className="text-sm text-gray-900">平均正答率: {(metrics.summary?.[k]?.avg_accuracy_pct ?? 0).toFixed(1)}%</div>
                      <div className="text-sm text-gray-900">平均反応時間: {metrics.summary?.[k]?.avg_latency_ms ?? 0}ms</div>
                    </div>
                  ))}
                </div>
                {/* シンプルな日別棒グラフ（直近のdaily） */}
                {Array.isArray(metrics.daily) && metrics.daily.length > 0 && (
                  <div className="mt-6">
                    <div className="text-sm text-gray-700 mb-2">直近の学習量（正答/誤答/タイムアウト）</div>
                    <ResponsiveBars data={metrics.daily} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* クイズ履歴（フィルタ/ページング/埋め込み） */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                クイズ履歴
              </h3>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-6 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">レベル</label>
                  <input value={historyLevel} onChange={(e) => setHistoryLevel(e.target.value)} className="w-full px-2 py-1 border rounded text-gray-900" placeholder="例: 1" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">開始日</label>
                  <input type="date" value={historySince} onChange={(e) => setHistorySince(e.target.value)} className="w-full px-2 py-1 border rounded text-gray-900" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">終了日</label>
                  <input type="date" value={historyUntil} onChange={(e) => setHistoryUntil(e.target.value)} className="w-full px-2 py-1 border rounded text-gray-900" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">件数</label>
                  <select value={historyPageSize} onChange={(e) => setHistoryPageSize(parseInt(e.target.value, 10))} className="w-full px-2 py-1 border rounded text-gray-900">
                    {[10,20,30,50].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2 flex items-end gap-2">
                  <button
                    onClick={() => fetchHistory(1, historyPageSize, historyLevel, historySince, historyUntil)}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                  >
                    適用
                  </button>
                  <button
                    onClick={() => { setHistoryLevel(''); setHistorySince(''); setHistoryUntil(''); setHistoryOrder('created_at_desc'); fetchHistory(1, historyPageSize, '', '', ''); }}
                    className="px-3 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200"
                  >
                    クリア
                  </button>
                </div>
              </div>
              {/* 並び順 */}
              <div className="mt-3 grid grid-cols-1 md:grid-cols-6 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">ソート</label>
                  <select value={historyOrder} onChange={(e) => setHistoryOrder(e.target.value as any)} className="w-full px-2 py-1 border rounded">
                    <option value="created_at_desc">新しい順</option>
                    <option value="created_at_asc">古い順</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      クイズ名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      レベル
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      スコア
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      正答率
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      所要時間
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      作成日時
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(history?.results || []).map((row: any, idx: number) => (
                    <tr key={row.quiz_set?.id || idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <a className="text-indigo-600 hover:underline" href={`/quiz/${row.quiz_set?.id}/result`} target="_blank" rel="noopener noreferrer">
                          {row.quiz_set?.name || 'クイズ'}
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">L{row.quiz_set?.level}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          (row.score_pct || 0) >= 80 
                            ? 'bg-green-100 text-green-800'
                            : (row.score_pct || 0) >= 60
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {row.score_pct || 0}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.total_correct}/{row.total_questions}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDuration(Math.round((row.total_duration_ms || 0)/1000))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(row.quiz_set?.created_at).toLocaleDateString('ja-JP')} {new Date(row.quiz_set?.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(!history || (history.results || []).length === 0) && (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">📝</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  クイズ履歴がありません
                </h3>
                <p className="text-gray-600">
                  まだクイズを受験していません。
                </p>
              </div>
            )}

            {history && history.total > 0 && (
              <div className="flex items-center justify-between px-4 py-4">
                <div className="text-sm text-gray-600">全 {history.total} 件 / ページ {history.page}</div>
                <div className="space-x-2">
                  <button
                    disabled={historyPage <= 1}
                    onClick={() => fetchHistory(Math.max(1, historyPage - 1), historyPageSize, historyLevel, historySince, historyUntil)}
                    className={`px-3 py-1 rounded border ${historyPage <= 1 ? 'text-gray-400 border-gray-200' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                  >前へ</button>
                  <button
                    disabled={(history.page * history.page_size) >= history.total}
                    onClick={() => fetchHistory(historyPage + 1, historyPageSize, historyLevel, historySince, historyUntil)}
                    className={`px-3 py-1 rounded border ${(history.page * history.page_size) >= history.total ? 'text-gray-400 border-gray-200' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                  >次へ</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// 軽量な簡易棒グラフ（依存なし、レスポンシブ横スクロール）
function ResponsiveBars({ data }: { data: Array<{ bucket: string; correct: number; incorrect: number; timeout: number; total: number }> }) {
  // 正規化
  const items = (data || []).slice(-14); // 直近14
  const maxTotal = Math.max(1, ...items.map(d => Number(d.total || 0)));
  const barWidth = 24;
  const gap = 12;
  const height = 100;
  const width = items.length * (barWidth + gap) + gap;
  const toX = (i: number) => gap + i * (barWidth + gap);
  const toH = (v: number) => Math.max(0, Math.round((v / maxTotal) * height));
  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height + 30} className="min-w-full">
        {items.map((d, i) => {
          const hC = toH(d.correct || 0);
          const hI = toH(d.incorrect || 0);
          const hT = toH(d.timeout || 0);
          const x = toX(i);
          const yT = height - hT;
          const yI = height - (hT + hI);
          const yC = height - (hT + hI + hC);
          return (
            <g key={i}>
              {/* timeout (red) */}
              <rect x={x} y={yT} width={barWidth} height={hT} fill="#ef4444" opacity={0.7} />
              {/* incorrect (amber) */}
              <rect x={x} y={yI} width={barWidth} height={hI} fill="#f59e0b" opacity={0.8} />
              {/* correct (green) */}
              <rect x={x} y={yC} width={barWidth} height={hC} fill="#10b981" opacity={0.9} />
              {/* label */}
              <text x={x + barWidth / 2} y={height + 12} textAnchor="middle" fontSize="10" fill="#374151">
                {new Date(d.bucket).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
              </text>
            </g>
          );
        })}
        {/* 軸線 */}
        <line x1={0} y1={height} x2={width} y2={height} stroke="#e5e7eb" />
      </svg>
    </div>
  );
}
