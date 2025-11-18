'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
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
import LoadingSpinner from '@/components/LoadingSpinner';

type ViewMode = 'daily' | 'weekly' | 'monthly';
type PeriodPreset = '7d' | '30d' | '90d' | 'all';

type ChartDailyItem = {
  date: string;
  correct_count: number;
  incorrect_count: number;
  timeout_count: number;
  total_time_ms: number;
};

type ChartPeriodItem = {
  period: string;
  label: string;
  correct_count: number;
  incorrect_count: number;
  timeout_count: number;
  total_time_ms: number;
  from_date?: string;
  to_date?: string;
};

type MistakeItem = {
  vocabulary_id: string;
  text_en: string | null;
  answer_count: number;
  correct_count: number;
  incorrect_count: number;
  timeout_count: number;
  accuracy: number;
  last_incorrect_at?: string | null;
};

type LearningStatusPayload = {
  period: string;
  period_summary: {
    answer_count: number;
    correct: number;
    incorrect: number;
    timeout: number;
    accuracy_rate: number;
    avg_reaction_time_sec: number;
  };
  streak: { current: number; best: number; total_learning_days: number; last_activity_date: string | null };
  charts: {
    daily: ChartDailyItem[];
    weekly: ChartPeriodItem[];
    monthly: ChartPeriodItem[];
  };
  top_mistakes: MistakeItem[];
  weak_words?: MistakeItem[];
};

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend, ChartTitle);

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const d = new Date(value);
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

export default function LearningStatusPage() {
  const { status, data } = useSession();
  const router = useRouter();
  const [payload, setPayload] = useState<LearningStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [period, setPeriod] = useState<PeriodPreset>('30d');

  useEffect(() => {
    if (status === 'loading') return;
    if (!data) {
      router.push('/auth/signin');
      return;
    }
    const fetchSummary = async () => {
      try {
        setLoading(true);
        const res = (await apiGet(`/api/student/learning-status/?period=${period}`)) as LearningStatusPayload;
        setPayload(res);
      } catch (err) {
        console.error(err);
        setError('学習状況の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [status, data, router, period]);

  const chartScrollRef = useRef<HTMLDivElement | null>(null);

  const fillDailyRaw = useMemo<ChartDailyItem[]>(() => payload?.charts.daily || [], [payload]);
  const fillWeeklyRaw = useMemo<ChartPeriodItem[]>(() => payload?.charts.weekly || [], [payload]);
  const fillMonthlyRaw = useMemo<ChartPeriodItem[]>(() => payload?.charts.monthly || [], [payload]);

  const buildDaily = useMemo<ChartDailyItem[]>(() => {
    const map = new Map<string, ChartDailyItem>();
    fillDailyRaw.forEach((d) => map.set(d.date.slice(0, 10), d));
    const list: ChartDailyItem[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const found = map.get(key);
      list.push(
        found || {
          date: key,
          correct_count: 0,
          incorrect_count: 0,
          timeout_count: 0,
          total_time_ms: 0,
        },
      );
    }
    return list;
  }, [fillDailyRaw]);

  const buildWeekly = useMemo<ChartPeriodItem[]>(() => {
    if (!fillWeeklyRaw.length) return [];
    const map = new Map<string, ChartPeriodItem>();
    fillWeeklyRaw.forEach((w) => map.set(w.from_date || w.period, w));
    // 最新週の開始日を取得（データの最後を採用）
    const latest = fillWeeklyRaw[fillWeeklyRaw.length - 1];
    const latestStart = new Date(latest.from_date || latest.period);
    const list: ChartPeriodItem[] = [];
    for (let i = 7; i >= 0; i--) {
      const start = new Date(latestStart);
      start.setDate(latestStart.getDate() - i * 7);
      const key = start.toISOString().slice(0, 10);
      const label = `${start.getMonth() + 1}/${start.getDate()}`;
      const item = map.get(key);
      if (item) {
        list.push(item);
      } else {
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        list.push({
          period: key,
          label,
          correct_count: 0,
          incorrect_count: 0,
          timeout_count: 0,
          total_time_ms: 0,
          from_date: key,
          to_date: end.toISOString().slice(0, 10),
        });
      }
    }
    return list;
  }, [fillWeeklyRaw]);

  const buildMonthly = useMemo<ChartPeriodItem[]>(() => {
    if (!fillMonthlyRaw.length) return [];
    const map = new Map<string, ChartPeriodItem>();
    fillMonthlyRaw.forEach((m) => map.set(m.from_date || m.period, m));
    const latest = fillMonthlyRaw[fillMonthlyRaw.length - 1];
    const latestStart = new Date(latest.from_date || latest.period);
    const list: ChartPeriodItem[] = [];
    for (let i = 11; i >= 0; i--) {
      const start = new Date(latestStart);
      start.setMonth(latestStart.getMonth() - i);
      start.setDate(1);
      const key = start.toISOString().slice(0, 10);
      const label = `${start.getFullYear()}/${String(start.getMonth() + 1).padStart(2, '0')}`;
      const item = map.get(key);
      if (item) {
        list.push(item);
      } else {
        list.push({
          period: key,
          label,
          correct_count: 0,
          incorrect_count: 0,
          timeout_count: 0,
          total_time_ms: 0,
          from_date: key,
          to_date: key,
        });
      }
    }
    return list;
  }, [fillMonthlyRaw]);

  const labelOf = (item: ChartDailyItem | ChartPeriodItem) =>
    'date' in item
      ? new Date(item.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
      : item.label;

  const formatPeriodLabel = (item: ChartDailyItem | ChartPeriodItem) => {
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
    const from = item.from_date ? new Date(item.from_date) : new Date(item.period);
    return `${from.getFullYear()}年${String(from.getMonth() + 1).padStart(2, '0')}月`;
  };

  const chartData = viewMode === 'daily' ? buildDaily : viewMode === 'weekly' ? buildWeekly : buildMonthly;

  const tableRows = useMemo(() => {
    const source = chartData;
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
        sortKey,
      };
    });
    return withTotals.sort((a, b) => b.sortKey - a.sortKey);
  }, [chartData, viewMode]);

  const periodLabel = useMemo(() => {
    if (period === '7d') return '直近7日';
    if (period === '30d') return '直近30日';
    if (period === '90d') return '直近90日';
    return '全期間';
  }, [period]);

  // グラフ表示後に右端まで自動スクロール（描画後に毎回同じ順序で実行）
  useEffect(() => {
    const el = chartScrollRef.current;
    if (!el || chartData.length === 0) return;
    requestAnimationFrame(() => {
      el.scrollLeft = el.scrollWidth;
    });
  }, [viewMode, chartData]);

  const renderBarChart = (data: Array<ChartDailyItem | ChartPeriodItem>) => {
    if (!data.length) {
      return <div className="text-sm text-slate-500">まだ学習データがありません。</div>;
    }

    const labels = data.map(labelOf);
    const totals = data.map((d) => d.correct_count + d.incorrect_count + d.timeout_count);
    const datasets = [
      { label: '正解', data: data.map((d) => d.correct_count), backgroundColor: '#34d399', stack: 'counts' },
      { label: '不正解', data: data.map((d) => d.incorrect_count), backgroundColor: '#fca5a5', stack: 'counts' },
      { label: 'Timeout', data: data.map((d) => d.timeout_count), backgroundColor: '#fcd34d', stack: 'counts' },
    ];

    return (
      <div className="w-full overflow-x-auto" ref={chartScrollRef}>
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
                  text:
                    viewMode === 'daily'
                      ? `日別（${periodLabel}）`
                      : viewMode === 'weekly'
                        ? `週別（${periodLabel}）`
                        : `月別（${periodLabel}）`,
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

  if (error) {
    return (
      <div className="max-w-5xl mx-auto py-12 px-4">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!data || !payload) {
    return (
      <div className="max-w-5xl mx-auto py-12 px-4">
        <p className="text-slate-600">データの取得に失敗しました。時間をおいて再度お試しください。</p>
      </div>
    );
  }

  const mistakes = payload.top_mistakes?.length ? payload.top_mistakes : payload.weak_words || [];

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-8 px-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900">学習状況</h1>
        <p className="text-slate-600 text-sm">期間サマリーとグラフで学習の傾向を確認できます。</p>
      </header>

      <section className="bg-white shadow rounded-lg p-4 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">期間サマリー</h2>
            <p className="text-xs text-slate-500">この期間設定がサマリー・苦手単語・グラフに反映されます。</p>
          </div>
          <div className="flex items-center gap-2">
            {(['7d', '30d', '90d', 'all'] as PeriodPreset[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-md text-sm font-semibold ${
                  period === p ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {p === '7d' ? '直近7日' : p === '30d' ? '直近30日' : p === '90d' ? '直近90日' : '全期間'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1">
          {[
            { title: '学習量', value: payload.period_summary.answer_count, unit: '問', sub: `正解 ${payload.period_summary.correct} / 不正解 ${payload.period_summary.incorrect}（Timeout ${payload.period_summary.timeout}含む）` },
            { title: '正解率', value: payload.period_summary.accuracy_rate.toFixed(1), unit: '%', sub: '正解 ÷ (正解+不正解+Timeout)' },
            { title: '平均回答時間', value: payload.period_summary.avg_reaction_time_sec.toFixed(1), unit: '秒', sub: 'Timeoutは平均から除外' },
            { title: 'Timeout', value: payload.period_summary.timeout, unit: '問', sub: '期間内の Timeout 件数' },
          ].map((card) => (
            <div key={card.title} className="min-w-[220px] flex-1 bg-slate-50 rounded-lg p-4 border border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">{card.title}</p>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">期間: {periodLabel}</span>
              </div>
              <p className="text-3xl font-bold text-slate-900">
                {card.value}
                <span className="text-base font-semibold text-slate-500 ml-1">{card.unit}</span>
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">{card.sub}</p>
            </div>
          ))}
        </div>

        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">よく間違える単語</p>
              <p className="text-xs text-slate-500">サマリーと同じ期間で上位を表示します（不正解+Timeout順）。</p>
            </div>
            <span className="text-xs text-slate-500">期間: {periodLabel}</span>
          </div>
          {mistakes.length === 0 ? (
            <p className="text-sm text-slate-600">データがありません。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[640px] w-full text-sm text-slate-800">
                <thead>
                  <tr className="bg-slate-50 text-slate-600">
                    <th className="px-3 py-2 text-left">単語</th>
                    <th className="px-3 py-2 text-right">回答数</th>
                    <th className="px-3 py-2 text-right">正解</th>
                    <th className="px-3 py-2 text-right">不正解</th>
                    <th className="px-3 py-2 text-right">Timeout</th>
                    <th className="px-3 py-2 text-right">正解率</th>
                    <th className="px-3 py-2 text-right">最終回答日</th>
                  </tr>
                </thead>
                <tbody>
                  {mistakes.map((word) => {
                    const incorrectTotal = word.incorrect_count + word.timeout_count;
                    const accuracy = word.answer_count > 0 ? (word.correct_count / word.answer_count) * 100 : 0;
                    return (
                      <tr key={word.vocabulary_id} className="border-b last:border-0 border-slate-100">
                        <td className="px-3 py-2">{word.text_en || '（語彙なし）'}</td>
                        <td className="px-3 py-2 text-right font-semibold">{word.answer_count}</td>
                        <td className="px-3 py-2 text-right text-green-600">{word.correct_count}</td>
                        <td className="px-3 py-2 text-right text-red-500">{incorrectTotal}</td>
                        <td className="px-3 py-2 text-right text-amber-600">{word.timeout_count}</td>
                        <td className="px-3 py-2 text-right">{word.answer_count ? `${accuracy.toFixed(1)}%` : '-'}</td>
                        <td className="px-3 py-2 text-right text-slate-500">{formatDate(word.last_incorrect_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="bg-white shadow rounded-lg p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">学習量（正解/不正/Timeout）</h2>
            <p className="text-sm text-slate-500">期間: {periodLabel}（粒度は日/週/月で切替）</p>
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

        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">集計テーブル</p>
              <p className="text-xs text-slate-500">グラフと同じ粒度・期間に連動します。</p>
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
                  </tr>
                ))}
              </tbody>
            </table>
            {tableRows.length === 0 && <p className="text-sm text-slate-500 mt-2">まだ学習データがありません。</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
