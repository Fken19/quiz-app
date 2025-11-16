'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useParams } from 'next/navigation';
import { apiGet } from '@/lib/api-utils';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  Title as ChartTitle,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend, ChartTitle);

const formatDateKey = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
type GraphTab = 'daily' | 'level' | 'weak';
type Granularity = 'daily' | 'weekly' | 'monthly';

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
  const [graphTab, setGraphTab] = useState<GraphTab>('daily');
  const [granularity, setGranularity] = useState<Granularity>('daily');

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

  const dailyMap = useMemo(() => {
    const map = new Map<string, DailyItem>();
    (daily || []).forEach((d) => map.set(d.date, d));
    return map;
  }, [daily]);

  const filledDaily = useMemo(() => {
    const result: { label: string; total: number; correct: number; incorrect: number; timeout: number; key: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = formatDateKey(d);
      const found = dailyMap.get(key);
      const totals = {
        correct: found?.correct_count || 0,
        incorrect: found?.incorrect_count || 0,
        timeout: found?.timeout_count || 0,
      };
      const label = d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
      result.push({
        key,
        label,
        total: totals.correct + totals.incorrect + totals.timeout,
        correct: totals.correct,
        incorrect: totals.incorrect,
        timeout: totals.timeout,
      });
    }
    return result;
  }, [dailyMap]);

  const weeklyMap = useMemo(() => {
    const map = new Map<
      string,
      { start: Date; correct: number; incorrect: number; timeout: number; label: string }
    >();
    (daily || []).forEach((d) => {
      const dateObj = new Date(d.date);
      const day = dateObj.getDay();
      const diff = (day + 6) % 7; // Monday start
      const monday = new Date(dateObj);
      monday.setDate(dateObj.getDate() - diff);
      monday.setHours(0, 0, 0, 0);
      const key = formatDateKey(monday);
      if (!map.has(key)) {
        map.set(key, {
          start: monday,
          correct: 0,
          incorrect: 0,
          timeout: 0,
          label: `${monday.getMonth() + 1}/${monday.getDate()}`,
        });
      }
      const ref = map.get(key)!;
      ref.correct += d.correct_count;
      ref.incorrect += d.incorrect_count;
      ref.timeout += d.timeout_count;
    });
    return map;
  }, [daily]);

  const filledWeekly = useMemo(() => {
    const result: { label: string; total: number; correct: number; incorrect: number; timeout: number; key: string }[] = [];
    const today = new Date();
    const currentMonday = new Date(today);
    const day = currentMonday.getDay();
    const diff = (day + 6) % 7;
    currentMonday.setDate(currentMonday.getDate() - diff);
    currentMonday.setHours(0, 0, 0, 0);

    for (let i = 7; i >= 0; i--) {
      const start = new Date(currentMonday);
      start.setDate(currentMonday.getDate() - i * 7);
      const key = formatDateKey(start);
      const found = weeklyMap.get(key);
      const totals = {
        correct: found?.correct || 0,
        incorrect: found?.incorrect || 0,
        timeout: found?.timeout || 0,
      };
      const label = `${start.getMonth() + 1}/${start.getDate()}`;
      result.push({
        key,
        label,
        total: totals.correct + totals.incorrect + totals.timeout,
        correct: totals.correct,
        incorrect: totals.incorrect,
        timeout: totals.timeout,
      });
    }
    return result;
  }, [weeklyMap]);

  const monthlyMap = useMemo(() => {
    const map = new Map<
      string,
      { start: Date; correct: number; incorrect: number; timeout: number; label: string }
    >();
    (daily || []).forEach((d) => {
      const dateObj = new Date(d.date);
      const start = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
      const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
      if (!map.has(key)) {
        map.set(key, {
          start,
          correct: 0,
          incorrect: 0,
          timeout: 0,
          label: `${start.getFullYear()}/${start.getMonth() + 1}`,
        });
      }
      const ref = map.get(key)!;
      ref.correct += d.correct_count;
      ref.incorrect += d.incorrect_count;
      ref.timeout += d.timeout_count;
    });
    return map;
  }, [daily]);

  const filledMonthly = useMemo(() => {
    const result: { label: string; total: number; correct: number; incorrect: number; timeout: number; key: string }[] = [];
    const today = new Date();
    for (let i = 11; i >= 0; i--) {
      const start = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
      const found = monthlyMap.get(key);
      const totals = {
        correct: found?.correct || 0,
        incorrect: found?.incorrect || 0,
        timeout: found?.timeout || 0,
      };
      const label = `${start.getFullYear()}/${start.getMonth() + 1}`;
      result.push({
        key,
        label,
        total: totals.correct + totals.incorrect + totals.timeout,
        correct: totals.correct,
        incorrect: totals.incorrect,
        timeout: totals.timeout,
      });
    }
    return result;
  }, [monthlyMap]);

  const aggregatedDailyForChart = useMemo(() => {
    if (granularity === 'weekly') return filledWeekly;
    if (granularity === 'monthly') return filledMonthly;
    return filledDaily;
  }, [filledDaily, filledWeekly, filledMonthly, granularity]);

  const renderDailyChart = () => {
    if (aggregatedDailyForChart.length === 0) {
      return <p className="text-sm text-slate-500">まだ学習データがありません。</p>;
    }

    const labels = aggregatedDailyForChart.map((d) => d.label);
    const data = {
      labels,
      datasets: [
        { label: '正解', data: aggregatedDailyForChart.map((d) => d.correct), backgroundColor: '#34d399', stack: 'counts' },
        { label: '不正解', data: aggregatedDailyForChart.map((d) => d.incorrect), backgroundColor: '#fb923c', stack: 'counts' },
        { label: 'Timeout', data: aggregatedDailyForChart.map((d) => d.timeout), backgroundColor: '#cbd5e1', stack: 'counts' },
      ],
    };
    const granularityLabel = granularity === 'weekly' ? '週別' : granularity === 'monthly' ? '月別' : '日別';
    return (
      <div className="w-full overflow-x-auto">
        <div className="min-w-[720px] h-[320px]">
          <Bar
            data={data}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                x: { stacked: true, grid: { display: false }, ticks: { color: '#475569' } },
                y: { stacked: true, grid: { color: '#e2e8f0' }, ticks: { color: '#475569', precision: 0 } },
              },
              plugins: {
                legend: { display: true, position: 'bottom' },
                title: {
                  display: true,
                  text: `学習量（${granularityLabel}）`,
                  color: '#475569',
                  font: { weight: '600', size: 14 },
                  padding: { bottom: 12 },
                },
                tooltip: {
                  callbacks: {
                    footer: (items) => {
                      const idx = items[0].dataIndex;
                      const row = aggregatedDailyForChart[idx];
                      return `合計: ${row?.total ?? 0}問`;
                    },
                  },
                },
              },
            }}
          />
        </div>
      </div>
    );
  };

  const renderLevelChart = () => {
    const labels = levels.map((l) => l.level_label || l.level_code || '未設定');
    const data = {
      labels,
      datasets: [
        {
          label: '正解率',
          data: levels.map((l) => l.accuracy),
          backgroundColor: '#6366f1',
        },
      ],
    };
    return (
      <div className="w-full overflow-x-auto">
        <div className="min-w-[720px] h-[320px]">
          <Bar
            data={data}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                x: { grid: { display: false }, ticks: { color: '#475569' } },
                y: { min: 0, max: 100, grid: { color: '#e2e8f0' }, ticks: { color: '#475569', callback: (v) => `${v}%` } },
              },
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (ctx) => {
                      const idx = ctx.dataIndex;
                      const lv = levels[idx];
                      return `正答率: ${ctx.parsed.y.toFixed(1)}% / 回答数: ${lv.answer_count} (正解${lv.correct_count}, 不正解${lv.incorrect_count}, Timeout${lv.timeout_count})`;
                    },
                  },
                },
              },
            }}
          />
        </div>
      </div>
    );
  };

  const renderWeakChart = () => {
    const top = weakWords.slice(0, 10);
    const labels = top.map((w) => w.text_en || '');
    const data = {
      labels,
      datasets: [
        {
          label: '不正解数',
          data: top.map((w) => w.incorrect_count),
          backgroundColor: '#f87171',
        },
      ],
    };
    return (
      <div className="w-full overflow-x-auto">
        <div className="min-w-[720px] h-[320px]">
          <Bar
            data={data}
            options={{
              indexAxis: 'y',
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                x: { grid: { color: '#e2e8f0' }, ticks: { color: '#475569', precision: 0 } },
                y: { grid: { display: false }, ticks: { color: '#475569' } },
              },
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (ctx) => {
                      const idx = ctx.dataIndex;
                      const w = top[idx];
                      return `不正解 ${w.incorrect_count} / 回答 ${w.answer_count} / 正答率 ${w.answer_count ? w.accuracy.toFixed(1) + '%' : '-'}`;
                    },
                  },
                },
              },
            }}
          />
        </div>
      </div>
    );
  };

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

      <section className="bg-white shadow rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">グラフ</h2>
          <div className="flex gap-2">
            {(['daily', 'level', 'weak'] as GraphTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setGraphTab(tab)}
                className={`px-3 py-1 rounded border text-sm ${
                  graphTab === tab ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-300 text-slate-700'
                }`}
              >
                {tab === 'daily' ? '日別' : tab === 'level' ? 'レベル別' : '弱点単語'}
              </button>
            ))}
          </div>
        </div>
        {graphTab === 'daily' && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-600">表示単位:</span>
            {(['daily', 'weekly', 'monthly'] as Granularity[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGranularity(g)}
                className={`px-3 py-1 rounded border text-xs ${
                  granularity === g ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-300 text-slate-700'
                }`}
              >
                {g === 'weekly' ? '週別' : g === 'monthly' ? '月別' : '日別'}
              </button>
            ))}
          </div>
        )}
        <div className="min-h-[340px]">
          {graphTab === 'daily' && renderDailyChart()}
          {graphTab === 'level' && renderLevelChart()}
          {graphTab === 'weak' && renderWeakChart()}
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
