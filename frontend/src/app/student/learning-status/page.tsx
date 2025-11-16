'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api-utils';
import type { DashboardDailyChartItem, DashboardPeriodChartItem, StudentDashboardSummary } from '@/types/quiz';
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
import LoadingSpinner from '@/components/LoadingSpinner';

type ViewMode = 'daily' | 'weekly' | 'monthly';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend, ChartTitle);

const formatDateKey = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function LearningStatusPage() {
  const { status, data } = useSession();
  const router = useRouter();
  const [summary, setSummary] = useState<StudentDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('daily');

  useEffect(() => {
    if (status === 'loading') return;
    if (!data) {
      router.push('/auth/signin');
      return;
    }
    const fetchSummary = async () => {
      try {
        setLoading(true);
        const res = (await apiGet('/api/student/dashboard-summary/')) as StudentDashboardSummary;
        setSummary(res);
      } catch (err) {
        console.error(err);
        setError('学習状況の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [status, data, router]);

  const dailyChart = useMemo(() => (summary?.recent_daily.chart || []).slice(-7), [summary]);
  const fillDaily = useMemo(() => {
    const map = new Map<string, DashboardDailyChartItem>();
    dailyChart.forEach((d) => map.set(d.date, d));
    const result: DashboardDailyChartItem[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = formatDateKey(d);
      result.push(
        map.get(key) || {
          date: key,
          correct_count: 0,
          incorrect_count: 0,
          timeout_count: 0,
          total_time_ms: 0,
          mastered_count: 0,
        },
      );
    }
    return result;
  }, [dailyChart]);
  const maxDaily = useMemo(() => {
    return Math.max(
      ...fillDaily.map((d) => d.correct_count + d.incorrect_count + d.timeout_count),
      1,
    );
  }, [fillDaily]);

  const weeklyChart = useMemo(() => summary?.weekly_chart?.chart || [], [summary]);
  const fillWeekly = useMemo(() => {
    const map = new Map<string, DashboardPeriodChartItem>();
    weeklyChart.forEach((d) => map.set(d.period, d));
    const result: DashboardPeriodChartItem[] = [];
    const today = new Date();
    const monday = new Date(today);
    const day = monday.getDay();
    const diff = (day + 6) % 7;
    monday.setDate(monday.getDate() - diff);
    for (let i = 7; i >= 0; i--) {
      const start = new Date(monday);
      start.setDate(monday.getDate() - i * 7);
      const key = formatDateKey(start);
      const label = `${start.getMonth() + 1}/${start.getDate()}`;
      const item = map.get(key);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const toKey = formatDateKey(end);
      result.push(
        item || {
          period: key,
          label,
          correct_count: 0,
          incorrect_count: 0,
          timeout_count: 0,
          total_time_ms: 0,
          mastered_count: 0,
          from_date: key,
          to_date: toKey,
        },
      );
    }
    return result;
  }, [weeklyChart]);
  const maxWeekly = useMemo(
    () => Math.max(...fillWeekly.map((d) => d.correct_count + d.incorrect_count + d.timeout_count), 1),
    [fillWeekly],
  );

  const monthlyChart = useMemo(() => summary?.monthly_chart?.chart || [], [summary]);
  const fillMonthly = useMemo(() => {
    const map = new Map<string, DashboardPeriodChartItem>();
    monthlyChart.forEach((d) => map.set(d.period, d));
    const result: DashboardPeriodChartItem[] = [];
    const today = new Date();
    for (let i = 11; i >= 0; i--) {
      const start = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = formatDateKey(start);
      const label = `${start.getFullYear()}/${String(start.getMonth() + 1).padStart(2, '0')}`;
      const item = map.get(key);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      const toKey = formatDateKey(end);
      result.push(
        item || {
          period: key,
          label,
          correct_count: 0,
          incorrect_count: 0,
          timeout_count: 0,
          total_time_ms: 0,
          mastered_count: 0,
          from_date: key,
          to_date: toKey,
        },
      );
    }
    return result;
  }, [monthlyChart]);
  const maxMonthly = useMemo(
    () => Math.max(...fillMonthly.map((d) => d.correct_count + d.incorrect_count + d.timeout_count), 1),
    [fillMonthly],
  );

  const chartData = viewMode === 'daily' ? fillDaily : viewMode === 'weekly' ? fillWeekly : fillMonthly;
  const maxTotal = viewMode === 'daily' ? maxDaily : viewMode === 'weekly' ? maxWeekly : maxMonthly;

  const labelOf = (item: DashboardDailyChartItem | DashboardPeriodChartItem) =>
    'date' in item
      ? new Date(item.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
      : item.label;

  const formatPeriodLabel = (item: DashboardDailyChartItem | DashboardPeriodChartItem) => {
    if ('date' in item) {
      const d = new Date(item.date);
      return d.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });
    }
    if (viewMode === 'weekly') {
      const from = item.from_date ? new Date(item.from_date) : new Date(item.period);
      const to = item.to_date ? new Date(item.to_date) : new Date(from.getTime() + 6 * 86400000);
      const fromStr = from.toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' });
      const toStr = to.toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' });
      return `${from.getFullYear()}/${fromStr}〜${toStr}`;
    }
    // monthly
    const from = item.from_date ? new Date(item.from_date) : new Date(item.period);
    return `${from.getFullYear()}年${String(from.getMonth() + 1).padStart(2, '0')}月`;
  };

  const tableRows = useMemo(() => {
    const source = viewMode === 'daily' ? fillDaily : viewMode === 'weekly' ? fillWeekly : fillMonthly;
    const withTotals = source.map((item) => {
      const answerCount = item.correct_count + item.incorrect_count + item.timeout_count;
      const accuracy = answerCount > 0 ? (item.correct_count / answerCount) * 100 : 0;
      const totalTimeMs = item.total_time_ms ?? 0;
      const avgSec = answerCount > 0 ? totalTimeMs / answerCount / 1000 : 0;
      const from = 'date' in item ? item.date : item.from_date || item.period;
      const to = 'date' in item ? item.date : item.to_date || item.period;
      const sortKey = new Date(to || from).getTime();
      return {
        key: 'date' in item ? item.date : item.period,
        periodLabel: formatPeriodLabel(item),
        answerCount,
        correct: item.correct_count,
        incorrect: item.incorrect_count,
        timeout: item.timeout_count,
        accuracy,
        avgSec,
        mastered: item.mastered_count ?? 0,
        sortKey,
      };
    });
    // 新しい期間を上に
    return withTotals.sort((a, b) => b.sortKey - a.sortKey);
  }, [fillDaily, fillWeekly, fillMonthly, viewMode]);

  const renderBarChart = (data: Array<DashboardDailyChartItem | DashboardPeriodChartItem>) => {
    if (!data.length) {
      return <div className="text-sm text-slate-500">まだ学習データがありません。</div>;
    }

    const labels = data.map(labelOf);
    const totals = data.map((d) => d.correct_count + d.incorrect_count + d.timeout_count);
    const datasets = [
      {
        label: '正解',
        data: data.map((d) => d.correct_count),
        backgroundColor: '#34d399',
        stack: 'counts',
      },
      {
        label: '不正解',
        data: data.map((d) => d.incorrect_count),
        backgroundColor: '#fca5a5',
        stack: 'counts',
      },
      {
        label: 'Timeout',
        data: data.map((d) => d.timeout_count),
        backgroundColor: '#fcd34d',
        stack: 'counts',
      },
    ];

    return (
      <div className="w-full overflow-x-auto">
        <div className="min-w-[900px] h-[420px]">
          <Bar
            data={{ labels, datasets }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                x: {
                  stacked: true,
                  grid: { display: false },
                  ticks: { color: '#475569', autoSkip: false, maxRotation: 45, minRotation: 45 },
                },
                y: {
                  stacked: true,
                  grid: { color: '#e2e8f0' },
                  ticks: { color: '#475569', precision: 0, beginAtZero: true },
                },
              },
              plugins: {
                legend: { display: false },
                title: {
                  display: true,
                  text: `学習量 (${viewMode === 'daily' ? '日別(直近7日)' : viewMode === 'weekly' ? '週別(直近8週)' : '月別(直近12ヶ月)'})`,
                },
                tooltip: {
                  callbacks: {
                    footer: (items) => {
                      const idx = items[0].dataIndex;
                      return `合計: ${totals[idx]}問`;
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

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!data || !summary) {
    return null;
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-12 px-4">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-12 space-y-8 px-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">学習状況</h1>
          <p className="text-slate-600 mt-1">日/週/月の学習量をグラフとテーブルで確認できます。</p>
        </div>
        <div className="flex items-center gap-2">
          {(['daily', 'weekly', 'monthly'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 rounded-md text-sm font-semibold ${
                viewMode === mode ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {mode === 'daily' ? '日別' : mode === 'weekly' ? '週別' : '月別'}
            </button>
          ))}
        </div>
      </header>

      <section className="bg-white shadow rounded-lg p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">学習量（正解/不正/Timeout）</h2>
            <p className="text-sm text-slate-500">棒グラフの色分けで内訳を確認できます。</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-green-400" /> 正解
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-red-300" /> 不正解
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-yellow-300" /> Timeout
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1">
            <span className="w-3.5 h-3.5 rounded-sm bg-green-400" /> 正解
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3.5 h-3.5 rounded-sm bg-red-300" /> 不正解
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3.5 h-3.5 rounded-sm bg-yellow-300" /> Timeout
          </span>
        </div>

        {renderBarChart(chartData)}

      </section>

      <section className="bg-white shadow rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">集計テーブル</h2>
            <p className="text-sm text-slate-500">グラフと同じ粒度で学習履歴を一覧表示します。</p>
          </div>
          <p className="text-xs text-slate-400">単位: 回答数=正解+不正解+Timeout / 時間=1語あたりの平均</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[840px] w-full text-sm text-slate-800">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="px-3 py-2 text-left">期間</th>
                <th className="px-3 py-2 text-right">回答数</th>
                <th className="px-3 py-2 text-right">正解</th>
                <th className="px-3 py-2 text-right">不正解</th>
                <th className="px-3 py-2 text-right">Timeout</th>
                <th className="px-3 py-2 text-right">正解率</th>
                <th className="px-3 py-2 text-right">平均時間</th>
                <th className="px-3 py-2 text-right">習得語数</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => (
                <tr key={row.key} className="border-b last:border-0 border-slate-100">
                  <td className="px-3 py-2 whitespace-nowrap">{row.periodLabel}</td>
                  <td className="px-3 py-2 text-right font-semibold">{row.answerCount}</td>
                  <td className="px-3 py-2 text-right text-green-600">{row.correct}</td>
                  <td className="px-3 py-2 text-right text-red-500">{row.incorrect}</td>
                  <td className="px-3 py-2 text-right text-amber-600">{row.timeout}</td>
                  <td className="px-3 py-2 text-right">{row.answerCount > 0 ? `${row.accuracy.toFixed(1)}%` : '-'}</td>
                  <td className="px-3 py-2 text-right">{row.answerCount > 0 ? `${row.avgSec.toFixed(1)}秒` : '-'}</td>
                  <td className="px-3 py-2 text-right">{row.mastered}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {tableRows.length === 0 && (
            <p className="text-sm text-slate-500 mt-2">まだ学習データがありません。</p>
          )}
        </div>
      </section>
    </div>
  );
}
