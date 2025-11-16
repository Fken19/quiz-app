'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiGet, apiPost } from '@/lib/api-utils';
import type {
  FocusQuestionsResponse,
  FocusQuizSessionResponse,
  LearningStatusKey,
  StudentDashboardSummary,
} from '@/types/quiz';

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

export default function DashboardPage() {
  const { status, data } = useSession();
  const router = useRouter();

  const [summary, setSummary] = useState<StudentDashboardSummary>(initialSummary);
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focusMessage, setFocusMessage] = useState<string | null>(null);
  const [focusLoading, setFocusLoading] = useState<LearningStatusKey | null>(null);
  const [focusModal, setFocusModal] = useState<{ statusKey: LearningStatusKey; response: FocusQuestionsResponse } | null>(
    null,
  );

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

  const dayChart = useMemo(() => summary.recent_daily.chart, [summary]);
  const maxDailyTotal = useMemo(() => summary.recent_daily.max_total || 1, [summary]);
  const weeklyChart = useMemo(() => summary.weekly_chart?.chart || [], [summary]);
  const maxWeeklyTotal = useMemo(() => summary.weekly_chart?.max_total || 1, [summary]);
  const monthlyChart = useMemo(() => summary.monthly_chart?.chart || [], [summary]);
  const maxMonthlyTotal = useMemo(() => summary.monthly_chart?.max_total || 1, [summary]);

  const heatColor = (total: number) => {
    const intensity = Math.min(1, total / (maxDailyTotal || 1));
    const base = 240 - Math.floor(intensity * 140); // slate→indigo寄り
    return `rgb(${base}, ${base + 10}, ${240})`;
  };

  const requestFocusQuestions = async (statusKey: LearningStatusKey, opts?: { supplement?: boolean }) => {
    const query = `/api/focus-questions/?status=${statusKey}&limit=10${
      opts?.supplement ? '&supplement=true' : ''
    }`;
    return (await apiGet(query)) as FocusQuestionsResponse;
  };

  const beginFocusSession = async (statusKey: LearningStatusKey, vocabularyIds: string[]) => {
    const payload = { vocabulary_ids: vocabularyIds.slice(0, 10), status: statusKey };
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
      const res = await requestFocusQuestions(statusKey);
      if (res.available_count === 0) {
        setFocusMessage(`「${statusLabels[statusKey]}」の語が見つかりません。別のステータスを選んでください。`);
        return;
      }
      if (res.available_count < res.requested_limit) {
        setFocusModal({ statusKey, response: res });
        return;
      }
      await beginFocusSession(statusKey, res.vocabulary_ids);
    } catch (err) {
      console.error(err);
      setFocusMessage('フォーカス対象の取得に失敗しました。');
    } finally {
      setFocusLoading(null);
    }
  };

  const handleFocusModalAction = async (mode: 'as-is' | 'supplement') => {
    if (!focusModal) return;
    const { statusKey, response } = focusModal;
    try {
      setFocusLoading(statusKey);
      setFocusMessage(null);
      let vocabIds = response.vocabulary_ids;
      if (mode === 'supplement') {
        const supplemented = await requestFocusQuestions(statusKey, { supplement: true });
        vocabIds = supplemented.vocabulary_ids;
      }
      await beginFocusSession(statusKey, vocabIds);
      setFocusModal(null);
    } catch (err) {
      console.error(err);
      setFocusMessage('フォーカス対象の取得に失敗しました。');
    } finally {
      setFocusLoading(null);
    }
  };

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

  const formatTimeMinutes = (ms: number) => `${Math.round(ms / 600) / 10}分`;

  const weeklyTotalQuestions =
    summary.weekly_summary.correct_count + summary.weekly_summary.incorrect_count + summary.weekly_summary.timeout_count;

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
          <h2 className="text-sm font-semibold text-slate-500">今日の成果</h2>
          <p className="mt-3 text-3xl font-bold text-slate-900">{summary.today_summary.correct_count} 問正解</p>
          <p className="mt-1 text-sm text-slate-500">
            不正解 {summary.today_summary.incorrect_count}・Timeout {summary.today_summary.timeout_count}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            合計時間 {formatTimeMinutes(summary.today_summary.total_time_ms)}
          </p>
        </div>
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-sm font-semibold text-slate-500">連続学習日数</h2>
          <p className="mt-3 text-3xl font-bold text-indigo-600">{summary.streak.current} 日</p>
          <p className="mt-1 text-sm text-slate-500">自己ベスト {summary.streak.best} 日</p>
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
                  {focusLoading === statusKey ? '準備中...' : '10問に挑戦'}
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
              <p className="text-sm text-slate-500">正解・不正解・Timeout の内訳です。</p>
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-900">{weeklyTotalQuestions} 問</p>
            <p className="text-xs text-slate-500 uppercase mt-1">正解 {summary.weekly_summary.correct_count} / 不正解 {summary.weekly_summary.incorrect_count} / Timeout {summary.weekly_summary.timeout_count}</p>
            <p className="text-xs text-slate-500 mt-1">合計時間 {formatTimeMinutes(summary.weekly_summary.total_time_ms)}</p>
          </div>
        </div>
      </section>

      <section className="bg-white shadow rounded-lg p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">学習量の推移</h2>
            <p className="text-sm text-slate-500">棒グラフ内の色分けで正解/不正/Timeoutを確認できます。</p>
          </div>
          <div className="flex items-center gap-2">
            {(['daily', 'weekly', 'monthly'] as const).map((mode) => (
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="grid grid-cols-7 gap-3">
            {(viewMode === 'daily' ? dayChart : viewMode === 'weekly' ? weeklyChart : monthlyChart).map((item) => {
              const total = item.correct_count + item.incorrect_count + item.timeout_count;
              const maxTotal =
                viewMode === 'daily'
                  ? maxDailyTotal
                  : viewMode === 'weekly'
                    ? maxWeeklyTotal
                    : maxMonthlyTotal || 1;
              const scale = Math.max(total / (maxTotal || 1), 0.05);
              const label =
                'date' in item
                  ? new Date(item.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
                  : item.label;
              return (
                <div key={('date' in item ? item.date : item.period) + viewMode} className="flex flex-col items-center gap-2">
                  <div className="h-36 w-8 bg-slate-100 rounded-lg flex flex-col justify-end overflow-hidden">
                    <div className="flex flex-col justify-end" style={{ height: `${scale * 100}%` }}>
                      <div
                        className="bg-green-400"
                        style={{ height: total ? `${(item.correct_count / total) * 100}%` : '0%' }}
                      />
                      <div
                        className="bg-red-300"
                        style={{ height: total ? `${(item.incorrect_count / total) * 100}%` : '0%' }}
                      />
                      <div
                        className="bg-yellow-300"
                        style={{ height: total ? `${(item.timeout_count / total) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 text-center">{label}</div>
                </div>
              );
            })}
          </div>

          {viewMode === 'daily' && (
            <div className="grid grid-cols-7 gap-2">
              {dayChart.map((day) => {
                const dayTotal = day.correct_count + day.incorrect_count + day.timeout_count;
                return (
                  <div key={`heat-${day.date}`} className="flex flex-col items-center gap-1">
                    <div
                      className="w-10 h-10 rounded-md border border-slate-200"
                      style={{ backgroundColor: heatColor(dayTotal) }}
                      title={`${dayTotal}問 (${day.correct_count}◯/${day.incorrect_count}×/${day.timeout_count}⏱)`}
                    />
                    <div className="text-[10px] text-slate-500">
                      {new Date(day.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {focusModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">フォーカス対象が不足しています</h3>
              <p className="text-sm text-slate-600 mt-1">
                「{statusLabels[focusModal.statusKey]}」は {focusModal.response.available_count} 件
                （必要{focusModal.response.requested_limit}件）でした。
              </p>
              {focusModal.response.filled_from && focusModal.response.filled_from.length > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  補充候補: {focusModal.response.filled_from.map((f) => `${statusLabels[f.status]}+${f.count}件`).join(' / ')}
                </p>
              )}
            </div>
            <div className="space-y-2 text-sm text-slate-700">
              <p>どうしますか？</p>
              <ul className="list-disc list-inside text-slate-600">
                <li>そのまま始める: 今ある分だけで開始</li>
                <li>不足を埋める: 他ステータスから補充して開始</li>
              </ul>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => handleFocusModalAction('as-is')}
                disabled={focusLoading !== null}
                className="flex-1 rounded-md bg-slate-100 text-slate-900 px-4 py-2 font-semibold hover:bg-slate-200 disabled:opacity-60"
              >
                この件数で始める
              </button>
              <button
                type="button"
                onClick={() => handleFocusModalAction('supplement')}
                disabled={focusLoading !== null}
                className="flex-1 rounded-md bg-indigo-600 text-white px-4 py-2 font-semibold hover:bg-indigo-700 disabled:opacity-60"
              >
                不足を埋めて始める
              </button>
            </div>
            <button
              type="button"
              onClick={() => setFocusModal(null)}
              className="w-full text-sm text-slate-500 hover:text-slate-700"
            >
              やめる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
