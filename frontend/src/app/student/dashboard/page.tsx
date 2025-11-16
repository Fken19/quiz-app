'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiGet } from '@/lib/api-utils';
import type { FocusQuestionsResponse, LearningStatusKey, StudentDashboardSummary } from '@/types/quiz';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focusMessage, setFocusMessage] = useState<string | null>(null);
  const [focusLoading, setFocusLoading] = useState<LearningStatusKey | null>(null);

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

  const handleFocusCheck = async (statusKey: LearningStatusKey) => {
    try {
      setFocusLoading(statusKey);
      setFocusMessage(null);
      const res = (await apiGet(`/api/focus-questions/?status=${statusKey}&limit=10`)) as FocusQuestionsResponse;
      if (res.available_count >= res.requested_limit) {
        setFocusMessage(`「${statusLabels[statusKey]}」の語は ${res.available_count} 件あります。まもなくフォーカス学習に対応予定です。`);
      } else {
        setFocusMessage(`「${statusLabels[statusKey]}」は ${res.available_count} 件のみです。足りない場合は範囲を広げてください。`);
      }
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
                  onClick={() => handleFocusCheck(statusKey)}
                  disabled={focusLoading === statusKey}
                  className="mt-auto inline-flex justify-center rounded-md border border-indigo-500 text-indigo-600 text-sm font-semibold px-3 py-2 hover:bg-indigo-50 disabled:opacity-50"
                >
                  {focusLoading === statusKey ? '確認中...' : '10問に挑戦'}
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

      <section className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">直近7日の推移</h2>
            <p className="text-sm text-slate-500">棒グラフをタップすると日別の内訳を確認できます。</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-7 gap-3">
          {dayChart.map((day) => {
            const dayTotal = day.correct_count + day.incorrect_count + day.timeout_count;
            const totalForScale = summary.recent_daily.max_total || 1;
            const scale = Math.max(dayTotal / totalForScale, 0.05);
            return (
              <div key={day.date} className="flex flex-col items-center gap-2">
                <div className="h-36 w-8 bg-slate-100 rounded-lg flex flex-col justify-end overflow-hidden">
                  <div className="flex flex-col justify-end" style={{ height: `${scale * 100}%` }}>
                    <div
                      className="bg-green-400"
                      style={{ height: dayTotal ? `${(day.correct_count / dayTotal) * 100}%` : '0%' }}
                    />
                    <div
                      className="bg-red-300"
                      style={{ height: dayTotal ? `${(day.incorrect_count / dayTotal) * 100}%` : '0%' }}
                    />
                    <div
                      className="bg-yellow-300"
                      style={{ height: dayTotal ? `${(day.timeout_count / dayTotal) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
                <div className="text-xs text-slate-500 text-center">
                  {new Date(day.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
