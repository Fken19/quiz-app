'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiGet, apiPost } from '@/lib/api-utils';
import { buildFocusQuestionOptions, FOCUS_MAX_LIMIT } from '@/lib/focus-utils';
import type {
  FocusQuestionsResponse,
  FocusQuizSessionResponse,
  LearningStatusKey,
  DashboardDailyChartItem,
  StudentDashboardSummary,
} from '@/types/quiz';

const MAX_HEATMAP_DAYS = 371; // 53週分（今日含む）
const VISIBLE_DAYS = 30; // 1画面に収める目安

const statusLabels: Record<LearningStatusKey, string> = {
  unlearned: '未学習',
  weak: '苦手',
  learning: '学習中',
  mastered: '得意',
};

const focusDescriptions: Record<LearningStatusKey, string> = {
  unlearned: 'これから覚える語',
  weak: '直近で間違えた語',
  learning: '定着途中の語',
  mastered: '連続正解の語',
};

const initialSummary: StudentDashboardSummary = {
  user: {
    user_id: '',
    email: '',
    oauth_provider: '',
    oauth_sub: '',
    disabled_at: null,
    deleted_at: null,
    created_at: '',
    updated_at: '',
    is_active: true,
  },
  streak: { current: 0, best: 0 },
  today_summary: { correct_count: 0, incorrect_count: 0, timeout_count: 0, total_time_ms: 0 },
  weekly_summary: { correct_count: 0, incorrect_count: 0, timeout_count: 0, total_time_ms: 0 },
  recent_daily: { chart: [], max_total: 0 },
  focus_summary: {
    unlearned: { count: 0 },
    weak: { count: 0 },
    learning: { count: 0 },
    mastered: { count: 0 },
  },
  quiz_result_count: 0,
  test_result_count: 0,
  pending_tests: 0,
};

type FocusDialogState = {
  statusKey: LearningStatusKey;
  availableCount: number;
  options: number[];
  selection: number;
  vocabIds: string[];
};

export default function DashboardPage() {
  const { status, data } = useSession();
  const router = useRouter();

  const [summary, setSummary] = useState<StudentDashboardSummary>(initialSummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focusMessage, setFocusMessage] = useState<string | null>(null);
  const [focusLoading, setFocusLoading] = useState<LearningStatusKey | null>(null);
  const [focusDialog, setFocusDialog] = useState<FocusDialogState | null>(null);
  const [heatmapColumnSize, setHeatmapColumnSize] = useState(24);
  const HEATMAP_GAP_PX = 4; // gap-1 相当
  const heatmapViewportRef = useRef<HTMLDivElement | null>(null);
  const heatmapScrollRef = useRef<HTMLDivElement | null>(null);

  // 直近 MAX_HEATMAP_DAYS 分のヒートマップデータを埋める（不足分は0で補完）
  const recentDaily = summary?.recent_daily?.chart ?? [];
  const heatmapDays = useMemo(() => {
    const map = new Map<string, DashboardDailyChartItem>();
    recentDaily.forEach((d) => map.set(d.date, d));
    const today = new Date();
    const days: DashboardDailyChartItem[] = [];
    for (let i = MAX_HEATMAP_DAYS - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      // タイムゾーン補正したローカル日付キー（YYYY-MM-DD, JST基準）
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
      const key = local.toISOString().slice(0, 10);
      const src = map.get(key);
      days.push(
        src || {
          date: key,
          correct_count: 0,
          incorrect_count: 0,
          timeout_count: 0,
        },
      );
    }
    return days;
  }, [recentDaily]);
  const maxHeatTotal = useMemo(
    () => Math.max(...heatmapDays.map((d) => d.correct_count + d.incorrect_count + d.timeout_count), 1),
    [heatmapDays],
  );
  const heatmapWeeks = useMemo(() => {
    const chunks: DashboardDailyChartItem[][] = [];
    for (let i = 0; i < heatmapDays.length; i += 7) {
      chunks.push(heatmapDays.slice(i, i + 7));
    }
    return chunks;
  }, [heatmapDays]);

  // 左側の曜日ラベル（7行ぶん）
  const weekdayLabels = useMemo(() => {
    if (!heatmapWeeks.length || !heatmapWeeks[0].length) return [] as string[];
    const firstDate = new Date(heatmapWeeks[0][0].date);
    const firstDow = firstDate.getDay(); // 0:日〜6:土
    const names = ['日', '月', '火', '水', '木', '金', '土'];
    const labels: string[] = [];
    for (let i = 0; i < 7; i++) {
      labels.push(names[(firstDow + i) % 7]);
    }
    return labels;
  }, [heatmapWeeks]);

  // 上側の月ラベル（週ごとに表示。同じ月が続く場合は省略）
  const monthLabels = useMemo(() => {
    return heatmapWeeks.map((week) => {
      if (!week.length) return '';
      const d = new Date(week[0].date);
      return `${d.getMonth() + 1}月`;
    });
  }, [heatmapWeeks]);

  // 最新が見えるようにスクロール位置を右端に
  useEffect(() => {
    const scroller = heatmapScrollRef.current;
    if (!scroller) return;
    if (scroller.scrollWidth <= scroller.clientWidth) return;

    requestAnimationFrame(() => {
      const el = heatmapScrollRef.current;
      if (!el) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      el.scrollLeft = maxScroll > 0 ? maxScroll : 0;
    });
  }, [heatmapWeeks, recentDaily.length, heatmapColumnSize]);

  // 一画面で30日前後が見えるようにサイズを調整しつつ、横スクロールにも対応
  useEffect(() => {
    const container = heatmapViewportRef.current;
    if (!container) return;

    const MIN_VISIBLE_WEEKS = Math.ceil(VISIBLE_DAYS / 7); // 約30日分=5週間
    const MIN_COL_SIZE = 14;
    const MAX_COL_SIZE = 140;

    const updateSize = () => {
      const width = container.clientWidth || 0;
      if (!width) return;
      const desired = width / MIN_VISIBLE_WEEKS - HEATMAP_GAP_PX;
      const next = Math.min(Math.max(desired, MIN_COL_SIZE), MAX_COL_SIZE);
      setHeatmapColumnSize(next);
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (!data) {
      router.push('/auth/signin');
      return;
    }

    const fetchSummary = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = (await apiGet('/api/student/dashboard-summary/')) as StudentDashboardSummary;
        setSummary(response);
      } catch (err) {
        console.error(err);
        setError('ダッシュボード情報の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [status, data, router]);

  const requestFocusQuestions = async (
    statusKey: LearningStatusKey,
    opts?: { supplement?: boolean; limit?: number },
  ) => {
    const limit = Math.min(Math.max(opts?.limit ?? 10, 1), FOCUS_MAX_LIMIT);
    const query = `/api/focus-questions/?status=${statusKey}&limit=${limit}${
      opts?.supplement ? '&supplement=true' : ''
    }`;
    return (await apiGet(query)) as FocusQuestionsResponse;
  };

  const beginFocusSession = async (statusKey: LearningStatusKey, vocabularyIds: string[]) => {
    if (!vocabularyIds.length) {
      setFocusMessage('フォーカス学習対象の語彙が見つかりませんでした。');
      return;
    }
    const payload = { vocabulary_ids: vocabularyIds, status: statusKey };
    const session = (await apiPost('/api/focus-quiz-sessions/', payload)) as FocusQuizSessionResponse;
    if (session && session.quiz_id) {
      router.push(`/student/quiz/play?quizId=${session.quiz_id}`);
    } else {
      setFocusMessage('フォーカス学習の開始に失敗しました。');
    }
  };

  const handleFocusStart = async (statusKey: LearningStatusKey) => {
    try {
      setFocusLoading(statusKey);
      setFocusMessage(null);
      const res = await requestFocusQuestions(statusKey, { limit: FOCUS_MAX_LIMIT });
      const available = res.available_count || res.vocabulary_ids.length;
      if (!available) {
        setFocusMessage(`「${statusLabels[statusKey]}」の語が見つかりません。別のステータスを選んでください。`);
        return;
      }
      const capped = Math.min(available, FOCUS_MAX_LIMIT);
      const options = buildFocusQuestionOptions(capped);
      if (!options.length) {
        setFocusMessage('フォーカス学習の対象が足りません。');
        return;
      }
      const vocabIds = Array.isArray(res.vocabulary_ids) ? res.vocabulary_ids : [];
      const defaultSelectionCandidate = Math.min(10, capped);
      const initialSelection = options.includes(defaultSelectionCandidate)
        ? defaultSelectionCandidate
        : options[options.length - 1];
      setFocusDialog({
        statusKey,
        availableCount: available,
        options,
        selection: initialSelection,
        vocabIds,
      });
    } catch (err) {
      console.error(err);
      setFocusMessage('フォーカス対象の取得に失敗しました。');
    } finally {
      setFocusLoading(null);
    }
  };

  const formatTimeMinutes = (ms: number) => `${Math.round(ms / 600) / 10}分`;

  const startFocusDialogSession = async () => {
    if (!focusDialog) return;
    const { statusKey, selection, vocabIds } = focusDialog;
    try {
      setFocusLoading(statusKey);
      setFocusMessage(null);
      let vocabIdsToUse = vocabIds;
      if (selection > vocabIds.length) {
        const refreshed = await requestFocusQuestions(statusKey, { limit: selection });
        vocabIdsToUse = refreshed.vocabulary_ids;
      }
      const selectedIds = vocabIdsToUse.slice(0, selection);
      await beginFocusSession(statusKey, selectedIds);
      setFocusDialog(null);
    } catch (err) {
      console.error(err);
      setFocusMessage('フォーカス学習の開始に失敗しました。');
    } finally {
      setFocusLoading(null);
    }
  };

  const todayTotals = useMemo(() => {
    const correct = summary.today_summary.correct_count;
    const incorrect = summary.today_summary.incorrect_count + summary.today_summary.timeout_count;
    const total = correct + incorrect;
    const avgSec = total > 0 ? (summary.today_summary.total_time_ms / 1000 / total).toFixed(1) : null;
    return { correct, incorrect, total, avgSec };
  }, [summary.today_summary]);

  const weeklyTotalQuestions =
    summary.weekly_summary.correct_count + summary.weekly_summary.incorrect_count + summary.weekly_summary.timeout_count;

  const weeklyTotals = useMemo(() => {
    const correct = summary.weekly_summary.correct_count;
    const incorrect = summary.weekly_summary.incorrect_count + summary.weekly_summary.timeout_count;
    const total = correct + incorrect;
    return { correct, incorrect, total, timeout: summary.weekly_summary.timeout_count };
  }, [summary.weekly_summary]);

  // ローカル日付(JST)ベースで recent_daily のみから週次データを生成
  const formatDateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const dailyTotalsByDate = useMemo(() => {
    const map = new Map<string, number>();
    const chart = summary.recent_daily?.chart ?? [];
    for (const row of chart) {
      const key = (row.date ?? '').slice(0, 10);
      if (!key) continue;
      const total = (row.correct_count ?? 0) + (row.incorrect_count ?? 0) + (row.timeout_count ?? 0);
      map.set(key, total);
    }
    return map;
  }, [summary.recent_daily]);

  const weeklyChartData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay(); // 0:日〜6:土
    const diffFromMonday = (dayOfWeek + 6) % 7; // 月曜=0
    const monday = new Date(today);
    monday.setDate(today.getDate() - diffFromMonday);

    const weekdayShort = ['日', '月', '火', '水', '木', '金', '土'];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const key = formatDateKey(d);
      const total = dailyTotalsByDate.get(key) ?? 0;
      return {
        label: `${d.getMonth() + 1}/${d.getDate()} (${weekdayShort[d.getDay()]})`,
        total,
        date: key,
      };
    });
  }, [dailyTotalsByDate]);

  const streakDerived = useMemo(() => {
    const flags = heatmapDays.map(
      (d) => (d.correct_count || 0) + (d.incorrect_count || 0) + (d.timeout_count || 0) > 0,
    );
    const totalActiveDays = flags.filter(Boolean).length;
    if (!flags.length) return { current: 0, totalActiveDays };

    let idx = flags.length - 1;
    let current = 0;

    if (flags[idx]) {
      while (idx >= 0 && flags[idx]) {
        current += 1;
        idx -= 1;
      }
    } else {
      while (idx >= 0 && !flags[idx]) idx -= 1;
      while (idx >= 0 && flags[idx]) {
        current += 1;
        idx -= 1;
      }
    }

    return { current, totalActiveDays };
  }, [heatmapDays]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto py-12 space-y-10 px-4">
      <header className="flex flex-col gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">学習ダッシュボード</h1>
          <p className="mt-1 text-slate-600">連続学習日数・フォーカス対象・直近7日の推移を確認できます。</p>
        </div>
        <div className="text-slate-500 text-sm">
          ログイン: <span className="font-semibold">{summary.user.email}</span>
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-sm font-semibold text-slate-500">今日の学習量</h2>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <p className="font-bold text-slate-900 text-3xl md:text-4xl">{todayTotals.total} 問</p>
            <p className="font-semibold text-slate-800 text-lg md:text-xl">
              合計 {formatTimeMinutes(summary.today_summary.total_time_ms)}
            </p>
          </div>
          <p className="mt-1 text-sm md:text-base text-slate-500">
            正解 {todayTotals.correct}問 / 不正解 {todayTotals.incorrect}問
          </p>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            1問あたり平均 {todayTotals.avgSec ? `${todayTotals.avgSec}秒` : '---'}
          </p>
        </div>
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-sm font-semibold text-slate-500">連続学習日数</h2>
          <p className="mt-3 font-bold text-indigo-600 text-3xl md:text-4xl">{summary.streak.current} 日</p>
          <p className="mt-1 text-sm md:text-base text-slate-500">自己ベスト {summary.streak.best} 日</p>
          <p className="mt-1 text-sm md:text-base text-slate-500">累計学習日数 {streakDerived.totalActiveDays} 日</p>
          <p className="mt-2 text-xs text-slate-500">
            累計クイズ {summary.quiz_result_count} 回 / テスト {summary.test_result_count} 回
          </p>
        </div>
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-sm font-semibold text-slate-500">お知らせ</h2>
          <p className="mt-3 text-2xl font-bold text-slate-900">{summary.pending_tests}</p>
          <p className="text-sm text-slate-500">未着手のテスト/宿題</p>
          <Link href="/student/tests" className="mt-3 inline-flex text-indigo-600 text-sm font-semibold">
            テスト一覧 →
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">フォーカス学習</h2>
              <p className="text-sm text-slate-500">ステータス別の語数と復習の候補です。</p>
            </div>
            <Link href="/student/quiz" className="text-sm text-indigo-600 font-semibold">
              クイズ一覧 →
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {(Object.keys(statusLabels) as LearningStatusKey[]).map((statusKey) => (
              <div key={statusKey} className="border rounded-lg p-4 flex flex-col gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-600">{statusLabels[statusKey]}</p>
                  <p className="text-xs text-slate-500">{focusDescriptions[statusKey]}</p>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {summary.focus_summary[statusKey].count}
                  <span className="text-sm font-medium text-slate-500 ml-1">語</span>
                </p>
                <button
                  type="button"
                  onClick={() => handleFocusStart(statusKey)}
                  disabled={focusLoading === statusKey}
                  className="mt-auto inline-flex justify-center rounded-md border border-indigo-500 text-indigo-600 text-sm font-semibold px-3 py-2 hover:bg-indigo-50 disabled:opacity-50"
                >
                  {focusLoading === statusKey ? '準備中...' : 'クイズに挑戦'}
                </button>
              </div>
            ))}
          </div>
          {focusMessage && (
            <div className="text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-md px-4 py-2">
              {focusMessage}
            </div>
          )}
        </div>

        <div className="bg-white shadow rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">今週の学習量</h2>
              <p className="text-sm text-slate-500">正解・不正解の合計です。</p>
            </div>
          </div>
          <div>
            <p className="font-bold text-slate-900 text-3xl md:text-4xl">{weeklyTotals.total} 問</p>
            <p className="text-sm md:text-base text-slate-500 mt-1">
              正解 {weeklyTotals.correct}問 / 不正解 {weeklyTotals.incorrect}問
            </p>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">合計時間 {formatTimeMinutes(summary.weekly_summary.total_time_ms)}</p>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-2 items-end">
            {weeklyChartData.map((d, idx) => {
              const max = Math.max(...weeklyChartData.map((v) => v.total), 1);
              const height = Math.max(6, Math.round((d.total / max) * 60));
              return (
                <div key={`${d.label}-${idx}`} className="flex flex-col items-center gap-1">
                  <div
                    className="w-full max-w-[18px] bg-indigo-100 rounded-sm relative group"
                    style={{ height }}
                    title={`${d.label}: ${d.total}問`}
                  >
                    <div className="w-full h-full bg-indigo-500 rounded-sm" />
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-slate-700 bg-white border border-slate-200 rounded px-2 py-1 shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      {d.label} {d.total}問
                    </div>
                  </div>
                  <span className="text-[10px] sm:text-[11px] text-slate-500">{d.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white shadow rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">直近の学習ヒートマップ（最大371日分）</h2>
            <p className="text-sm text-slate-500">画面には約30日分を表示し、それより古い分は横スクロールで確認できます。</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <span>少ない</span>
            <div className="flex gap-[3px]">
              {[0.25, 0.5, 0.75, 1].map((v) => (
                <span
                  key={v}
                  className="w-3 h-3 rounded-[3px]"
                  style={{ backgroundColor: `rgba(34,197,94,${v})` }}
                />
              ))}
            </div>
            <span>多い</span>
          </div>
        </div>

        {heatmapWeeks.length === 0 ? (
          <p className="text-xs text-slate-500">まだ学習データがありません。</p>
        ) : (
          <div ref={heatmapViewportRef} className="w-full">
            <div className="flex">
              {/* 曜日ラベル */}
              <div className="mr-2 flex flex-col gap-1 text-[10px] text-slate-400 flex-none">
                {weekdayLabels.map((label, rowIdx) => (
                  <div
                    key={rowIdx}
                    style={{ height: heatmapColumnSize }}
                    className="flex items-center"
                  >
                    {rowIdx % 2 === 0 ? label : ''}
                  </div>
                ))}
              </div>

              {/* ヒートマップ本体 + 月ラベル（横スクロール） */}
              <div ref={heatmapScrollRef} className="overflow-x-auto flex-1 min-w-0">
                <div
                  style={{
                    width: `${heatmapWeeks.length * (heatmapColumnSize + HEATMAP_GAP_PX)}px`,
                  }}
                >
                  {/* 月ラベル */}
                  <div className="flex gap-1 mb-1 text-[10px] text-slate-400">
                    {monthLabels.map((label, wIdx) => {
                      const show = wIdx === 0 || label !== monthLabels[wIdx - 1];
                      return (
                        <div
                          key={wIdx}
                          style={{ width: heatmapColumnSize }}
                          className="truncate"
                        >
                          {show ? label : ''}
                        </div>
                      );
                    })}
                  </div>

                  {/* 本体 */}
                  <div className="flex gap-1">
                    {heatmapWeeks.map((week, wIdx) => (
                      <div key={wIdx} className="flex flex-col gap-1" style={{ width: heatmapColumnSize }}>
                        {week.map((day) => {
                          const total = day.correct_count + day.incorrect_count + day.timeout_count;
                          const ratio = maxHeatTotal ? total / maxHeatTotal : 0;
                          const bg = total === 0 ? '#e5e7eb' : `rgba(34,197,94,${0.25 + 0.75 * ratio})`;
                          return (
                            <div
                              key={day.date}
                              className="rounded-[4px] border border-slate-200"
                              title={`${new Date(day.date).toLocaleDateString('ja-JP')} : ${total}問`}
                              style={{
                                backgroundColor: bg,
                                width: heatmapColumnSize,
                                height: heatmapColumnSize,
                              }}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {focusDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">フォーカス学習を開始</h3>
              <button
                type="button"
                onClick={() => setFocusDialog(null)}
                className="text-slate-500 hover:text-slate-700 text-sm"
              >
                閉じる
              </button>
            </div>
            <p className="text-sm text-slate-700">
              「{statusLabels[focusDialog.statusKey]}」の語から出題します。問題数を選んでください。
            </p>
            <p className="text-xs text-slate-500">
              対象: {focusDialog.availableCount}問（最大{FOCUS_MAX_LIMIT}問まで選択可能）
            </p>
            <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 divide-y">
              {focusDialog.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setFocusDialog((prev) => (prev ? { ...prev, selection: opt } : prev))}
                  className={`w-full px-4 py-3 text-left ${
                    focusDialog.selection === opt ? 'bg-amber-50 text-amber-700 font-semibold' : 'bg-white text-slate-800'
                  }`}
                >
                  {opt}問
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setFocusDialog(null)}
                className="px-4 py-2 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={startFocusDialogSession}
                disabled={focusLoading === focusDialog.statusKey}
                className="px-4 py-2 text-sm rounded-md bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {focusLoading === focusDialog.statusKey ? '開始中...' : '開始する'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
