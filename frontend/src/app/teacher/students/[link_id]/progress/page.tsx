'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useParams } from 'next/navigation';
import { apiGet } from '@/lib/api-utils';

type DailyItem = {
  date: string;
  correct_count: number;
  incorrect_count: number;
  timeout_count: number;
  total_time_ms: number;
};

type LevelItem = {
  level_code: string | null;
  level_label: string | null;
  correct_count: number;
  incorrect_count: number;
  timeout_count: number;
  answer_count: number;
  accuracy: number;
};

type SessionItem = {
  quiz_result_id: string;
  completed_at: string | null;
  started_at: string | null;
  quiz_title: string | null;
  level_code: string | null;
  level_label: string | null;
  question_count: number;
  correct_count: number;
  incorrect_count: number;
  timeout_count: number;
  accuracy: number;
  total_time_ms: number | null;
};

type WeakWordItem = {
  vocabulary_id: string;
  text_en: string | null;
  correct_count: number;
  incorrect_count: number;
  timeout_count: number;
  answer_count: number;
  accuracy: number;
  last_incorrect_at: string | null;
};

type ProgressSummary = {
  student_teacher_link_id: string;
  display_name: string;
  avatar_url?: string | null;
  status: string;
  bio?: string | null;
  last_activity?: string | null;
  groups: { roster_folder_id: string; name: string }[];
  date_from: string;
  date_to: string;
  totals: {
    answer_count: number;
    correct_count: number;
    incorrect_count: number;
    timeout_count: number;
    accuracy: number;
    avg_seconds: number;
  };
  daily_chart: DailyItem[];
};

type RangePreset = '7' | '30' | '90' | 'all';

export default function TeacherStudentProgressPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const linkId = params?.link_id as string;
  const fromParam = searchParams.get('from');
  const group = searchParams.get('group');

  const [range, setRange] = useState<RangePreset>('30');
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [daily, setDaily] = useState<DailyItem[]>([]);
  const [levels, setLevels] = useState<LevelItem[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [weakWords, setWeakWords] = useState<WeakWordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const buildQuery = () => {
    if (range === 'all') return '';
    const days = parseInt(range, 10);
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days + 1);
    const toStr = to.toISOString().slice(0, 10);
    const fromStr = from.toISOString().slice(0, 10);
    return `?from=${fromStr}&to=${toStr}`;
  };

  useEffect(() => {
    const fetchAll = async () => {
      if (!linkId) return;
      try {
        setLoading(true);
        setError(null);
        const query = buildQuery();
        const [summaryRes, dailyRes, levelRes, sessionRes, weakRes] = await Promise.all([
          apiGet(`/api/teacher/student-progress/${linkId}/summary/${query}`),
          apiGet(`/api/teacher/student-progress/${linkId}/daily-stats/${query}`),
          apiGet(`/api/teacher/student-progress/${linkId}/level-stats/${query}`),
          apiGet(`/api/teacher/student-progress/${linkId}/sessions/${query}`),
          apiGet(`/api/teacher/student-progress/${linkId}/weak-words/${query}`),
        ]);
        setSummary(summaryRes as ProgressSummary);
        setDaily((dailyRes as any)?.items || (dailyRes as any)?.daily_chart || []);
        setLevels((levelRes as any)?.items || []);
        setSessions((sessionRes as any)?.items || []);
        setWeakWords((weakRes as any)?.items || []);
      } catch (err) {
        console.error(err);
        setError('学習状況の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [linkId, range]);

  const dailyTotals = useMemo(() => {
    return (daily || []).map((d) => ({
      date: d.date,
      total: d.correct_count + d.incorrect_count + d.timeout_count,
      correct: d.correct_count,
      incorrect: d.incorrect_count,
      timeout: d.timeout_count,
    }));
  }, [daily]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-12 w-12 rounded-full border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="max-w-5xl mx-auto py-12 px-4">
        <p className="text-red-600">{error || 'データが見つかりませんでした'}</p>
      </div>
    );
  }

  const backLink =
    fromParam === 'group' && group
      ? { href: `/teacher/groups?folder=${group}`, label: '◀ グループに戻る' }
      : { href: '/teacher/students', label: '◀ 生徒一覧に戻る' };

  return (
    <div className="max-w-6xl mx-auto py-10 space-y-8 px-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">学習状況</h1>
          <p className="text-sm text-slate-600">リンクID: {summary.student_teacher_link_id}</p>
        </div>
        <Link href={backLink.href} className="text-indigo-600 font-semibold hover:underline text-sm">
          {backLink.label}
        </Link>
      </div>

      <section className="bg-white shadow rounded-lg p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            {summary.avatar_url ? (
              <img
                src={summary.avatar_url}
                alt={summary.display_name}
                className="w-16 h-16 rounded-full object-cover border border-slate-200"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-xl">
                {(summary.display_name || 'S').slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-lg font-semibold text-slate-900">{summary.display_name}</p>
              <p className="text-xs text-slate-600">ステータス: {summary.status}</p>
              {summary.bio && <p className="text-sm text-slate-700 mt-1">{summary.bio}</p>}
            </div>
          </div>
          <div className="text-sm text-slate-700 space-y-1">
            <p>期間: {summary.date_from} 〜 {summary.date_to}</p>
            <p>所属グループ: {(summary.groups || []).map((g) => g.name).join(', ') || 'なし'}</p>
            <p>最終学習日時: {summary.last_activity ? new Date(summary.last_activity).toLocaleString() : '---'}</p>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-600">期間プリセット:</span>
        {(['7', '30', '90', 'all'] as RangePreset[]).map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setRange(preset)}
            className={`px-3 py-1 rounded border text-sm ${
              range === preset ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-300 text-slate-700'
            }`}
          >
            {preset === 'all' ? '全期間' : `直近${preset}日`}
          </button>
        ))}
      </div>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white shadow rounded-lg p-4">
          <p className="text-xs text-slate-500">回答数</p>
          <p className="text-2xl font-bold text-slate-900">{summary.totals.answer_count}</p>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <p className="text-xs text-slate-500">正解率</p>
          <p className="text-2xl font-bold text-slate-900">
            {summary.totals.answer_count ? summary.totals.accuracy.toFixed(1) + '%' : '-'}
          </p>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <p className="text-xs text-slate-500">平均時間</p>
          <p className="text-2xl font-bold text-slate-900">
            {summary.totals.answer_count ? summary.totals.avg_seconds.toFixed(1) + '秒' : '-'}
          </p>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <p className="text-xs text-slate-500">Timeout</p>
          <p className="text-2xl font-bold text-slate-900">{summary.totals.timeout_count}</p>
        </div>
      </section>

      <section className="bg-white shadow rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">日別学習量</h2>
          <p className="text-xs text-slate-500">正解 / 不正解 / Timeout</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[640px] w-full text-sm text-slate-800">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="px-3 py-2 text-left">日付</th>
                <th className="px-3 py-2 text-right">合計</th>
                <th className="px-3 py-2 text-right text-green-600">正解</th>
                <th className="px-3 py-2 text-right text-red-500">不正解</th>
                <th className="px-3 py-2 text-right text-amber-600">Timeout</th>
              </tr>
            </thead>
            <tbody>
              {dailyTotals.map((d) => (
                <tr key={d.date} className="border-b last:border-0 border-slate-100">
                  <td className="px-3 py-2">{new Date(d.date).toLocaleDateString('ja-JP')}</td>
                  <td className="px-3 py-2 text-right font-semibold">{d.total}</td>
                  <td className="px-3 py-2 text-right text-green-600">{d.correct}</td>
                  <td className="px-3 py-2 text-right text-red-500">{d.incorrect}</td>
                  <td className="px-3 py-2 text-right text-amber-600">{d.timeout}</td>
                </tr>
              ))}
              {dailyTotals.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-sm text-slate-500">
                    期間内の学習データがありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white shadow rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">レベル別集計</h2>
          <p className="text-xs text-slate-500">正答率・回答数</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[640px] w-full text-sm text-slate-800">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="px-3 py-2 text-left">レベル</th>
                <th className="px-3 py-2 text-right">回答数</th>
                <th className="px-3 py-2 text-right text-green-600">正解</th>
                <th className="px-3 py-2 text-right text-red-500">不正解</th>
                <th className="px-3 py-2 text-right text-amber-600">Timeout</th>
                <th className="px-3 py-2 text-right">正解率</th>
              </tr>
            </thead>
            <tbody>
              {levels.map((lv) => (
                <tr key={lv.level_code || lv.level_label || 'unknown'} className="border-b last:border-0 border-slate-100">
                  <td className="px-3 py-2">{lv.level_label || lv.level_code || '未設定'}</td>
                  <td className="px-3 py-2 text-right font-semibold">{lv.answer_count}</td>
                  <td className="px-3 py-2 text-right text-green-600">{lv.correct_count}</td>
                  <td className="px-3 py-2 text-right text-red-500">{lv.incorrect_count}</td>
                  <td className="px-3 py-2 text-right text-amber-600">{lv.timeout_count}</td>
                  <td className="px-3 py-2 text-right">{lv.answer_count ? lv.accuracy.toFixed(1) + '%' : '-'}</td>
                </tr>
              ))}
              {levels.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-sm text-slate-500">データがありません。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white shadow rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">学習セッション履歴</h2>
          <p className="text-xs text-slate-500">最新50件（最大200件）</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[700px] w-full text-sm text-slate-800">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="px-3 py-2 text-left">日時</th>
                <th className="px-3 py-2 text-left">タイトル</th>
                <th className="px-3 py-2 text-left">レベル</th>
                <th className="px-3 py-2 text-right">回答数</th>
                <th className="px-3 py-2 text-right text-green-600">正解</th>
                <th className="px-3 py-2 text-right text-red-500">不正解</th>
                <th className="px-3 py-2 text-right text-amber-600">Timeout</th>
                <th className="px-3 py-2 text-right">正解率</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.quiz_result_id} className="border-b last:border-0 border-slate-100">
                  <td className="px-3 py-2">{s.completed_at ? new Date(s.completed_at).toLocaleString() : '---'}</td>
                  <td className="px-3 py-2">{s.quiz_title || '---'}</td>
                  <td className="px-3 py-2">{s.level_label || s.level_code || '-'}</td>
                  <td className="px-3 py-2 text-right font-semibold">{s.question_count}</td>
                  <td className="px-3 py-2 text-right text-green-600">{s.correct_count}</td>
                  <td className="px-3 py-2 text-right text-red-500">{s.incorrect_count}</td>
                  <td className="px-3 py-2 text-right text-amber-600">{s.timeout_count}</td>
                  <td className="px-3 py-2 text-right">{s.question_count ? s.accuracy.toFixed(1) + '%' : '-'}</td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-3 text-sm text-slate-500">セッションデータがありません。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white shadow rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">よく間違える単語</h2>
          <p className="text-xs text-slate-500">誤答が多い順に表示</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[640px] w-full text-sm text-slate-800">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="px-3 py-2 text-left">単語</th>
                <th className="px-3 py-2 text-right">回答数</th>
                <th className="px-3 py-2 text-right text-green-600">正解</th>
                <th className="px-3 py-2 text-right text-red-500">不正解</th>
                <th className="px-3 py-2 text-right text-amber-600">Timeout</th>
                <th className="px-3 py-2 text-right">正解率</th>
                <th className="px-3 py-2 text-right">直近誤答</th>
              </tr>
            </thead>
            <tbody>
              {weakWords.map((w) => (
                <tr key={w.vocabulary_id} className="border-b last:border-0 border-slate-100">
                  <td className="px-3 py-2">{w.text_en || '-'}</td>
                  <td className="px-3 py-2 text-right font-semibold">{w.answer_count}</td>
                  <td className="px-3 py-2 text-right text-green-600">{w.correct_count}</td>
                  <td className="px-3 py-2 text-right text-red-500">{w.incorrect_count}</td>
                  <td className="px-3 py-2 text-right text-amber-600">{w.timeout_count}</td>
                  <td className="px-3 py-2 text-right">{w.answer_count ? w.accuracy.toFixed(1) + '%' : '-'}</td>
                  <td className="px-3 py-2 text-right">
                    {w.last_incorrect_at ? new Date(w.last_incorrect_at).toLocaleString() : '-'}
                  </td>
                </tr>
              ))}
              {weakWords.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-3 text-sm text-slate-500">データがありません。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
