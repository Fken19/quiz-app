'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getStudentTests } from '@/lib/api/test';
import type { AvailableTest } from '@/types/test';

export default function AssignedTestsPage() {
  const router = useRouter();
  type TestStatus = 'available' | 'expired' | 'completed' | 'upcoming' | 'paused';
  const [tests, setTests] = useState<AvailableTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overlayAssignmentId, setOverlayAssignmentId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | TestStatus>('available');
  const [sortMode, setSortMode] = useState<'deadline_asc' | 'deadline_desc' | 'start_desc' | 'start_asc'>(
    'deadline_asc'
  );

  useEffect(() => {
    const fetchTests = async () => {
      try {
        setLoading(true);
        const response = await getStudentTests();
        setTests(response.available_tests);
      } catch (err) {
        console.error(err);
        setError('テスト情報の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchTests();
  }, []);

  const getStatusBadge = (test: AvailableTest) => {
    if (test.is_paused) {
      return <span className="inline-block px-2 py-1 text-xs font-semibold text-amber-700 bg-amber-100 rounded">停止中</span>;
    }
    if (!test.is_available) {
      const now = new Date();
      const start = test.assignment_schedule?.start_at ? new Date(test.assignment_schedule.start_at) : null;
      const end = test.assignment_schedule?.end_at ? new Date(test.assignment_schedule.end_at) : null;
      
      if (start && now < start) {
        return <span className="inline-block px-2 py-1 text-xs font-semibold text-blue-700 bg-blue-100 rounded">開始前</span>;
      } else {
        return <span className="inline-block px-2 py-1 text-xs font-semibold text-red-700 bg-red-100 rounded">期限切れ</span>;
      }
    }
    
    if (test.attempts_remaining === 0) {
      return <span className="inline-block px-2 py-1 text-xs font-semibold text-gray-700 bg-gray-100 rounded">受験済</span>;
    }
    
    return <span className="inline-block px-2 py-1 text-xs font-semibold text-green-700 bg-green-100 rounded">受験可能</span>;
  };

  const getPassBadge = (test: AvailableTest) => {
    if (test.best_score == null) {
      return (
        <span className="inline-block px-2 py-1 text-xs font-semibold text-slate-600 bg-slate-100 rounded">
          未受験
        </span>
      );
    }
    if (test.is_passed === true) {
      return (
        <span className="inline-block px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-100 rounded">
          合格
        </span>
      );
    }
    if (test.is_passed === false) {
      return (
        <span className="inline-block px-2 py-1 text-xs font-semibold text-rose-700 bg-rose-100 rounded">
          未合格
        </span>
      );
    }
    return (
      <span className="inline-block px-2 py-1 text-xs font-semibold text-slate-600 bg-slate-100 rounded">
        判定なし
      </span>
    );
  };

  const getDeadlineMeta = (test: AvailableTest) => {
    const end = test.assignment_schedule?.end_at ? new Date(test.assignment_schedule.end_at) : null;
    if (!end || Number.isNaN(end.getTime())) return { label: '期限未設定', tone: 'text-slate-500' };
    const now = new Date();
    const diffMs = end.getTime() - now.getTime();
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
    if (diffMs <= 0) return { label: '期限切れ', tone: 'text-rose-600' };
    if (diffHours <= 24) return { label: `あと${diffHours}時間`, tone: 'text-amber-600' };
    const diffDays = Math.ceil(diffHours / 24);
    return { label: `あと${diffDays}日`, tone: 'text-slate-600' };
  };

  const getTestStatus = (test: AvailableTest): TestStatus => {
    if (test.attempts_remaining === 0) return 'completed';
    if (test.is_paused) return 'paused';
    const now = new Date();
    const start = test.assignment_schedule?.start_at ? new Date(test.assignment_schedule.start_at) : null;
    const end = test.assignment_schedule?.end_at ? new Date(test.assignment_schedule.end_at) : null;
    if (start && now < start) return 'upcoming';
    if (end && now > end) return 'expired';
    if (test.is_available) return 'available';
    return 'expired';
  };

  const statusCounts = useMemo(() => {
    const counts: Record<'all' | TestStatus, number> = {
      all: tests.length,
      available: 0,
      expired: 0,
      completed: 0,
      upcoming: 0,
      paused: 0,
    };
    tests.forEach((test) => {
      const status = getTestStatus(test);
      counts[status] += 1;
    });
    return counts;
  }, [tests]);

  const filteredTests = useMemo(() => {
    const list = statusFilter === 'all' ? tests : tests.filter((test) => getTestStatus(test) === statusFilter);
    const compareByDate = (aValue: number | null, bValue: number | null, direction: 'asc' | 'desc') => {
      const aMissing = aValue == null || Number.isNaN(aValue);
      const bMissing = bValue == null || Number.isNaN(bValue);
      if (aMissing && bMissing) return 0;
      if (aMissing) return 1;
      if (bMissing) return -1;
      return direction === 'asc' ? aValue - bValue : bValue - aValue;
    };

    return [...list].sort((a, b) => {
      const endA = a.assignment_schedule?.end_at ? new Date(a.assignment_schedule.end_at).getTime() : null;
      const endB = b.assignment_schedule?.end_at ? new Date(b.assignment_schedule.end_at).getTime() : null;
      const startA = a.assignment_schedule?.start_at ? new Date(a.assignment_schedule.start_at).getTime() : null;
      const startB = b.assignment_schedule?.start_at ? new Date(b.assignment_schedule.start_at).getTime() : null;

      switch (sortMode) {
        case 'deadline_desc': {
          const result = compareByDate(endA, endB, 'desc');
          return result !== 0 ? result : a.title.localeCompare(b.title);
        }
        case 'start_desc': {
          const result = compareByDate(startA, startB, 'desc');
          return result !== 0 ? result : a.title.localeCompare(b.title);
        }
        case 'start_asc': {
          const result = compareByDate(startA, startB, 'asc');
          return result !== 0 ? result : a.title.localeCompare(b.title);
        }
        default: {
          const result = compareByDate(endA, endB, 'asc');
          return result !== 0 ? result : a.title.localeCompare(b.title);
        }
      }
    });
  }, [tests, statusFilter, sortMode]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto py-10">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-10 space-y-6 px-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">割り当てテスト</h1>
          <p className="text-slate-600">受験可能なテストが一覧表示されます。</p>
        </div>
        <Link href="/student/dashboard" className="text-indigo-600 font-semibold">← ダッシュボードへ戻る</Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-600 font-medium">表示:</span>
        {([
          { key: 'all', label: '全て' },
          { key: 'available', label: '受験可能' },
          { key: 'upcoming', label: '開始前' },
          { key: 'expired', label: '期限切れ' },
          { key: 'completed', label: '受験済み' },
          { key: 'paused', label: '停止中' },
        ] as const).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setStatusFilter(item.key)}
            className={`px-3 py-1 rounded-full border text-sm font-semibold ${
              statusFilter === item.key
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {item.label} ({statusCounts[item.key]})
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
          <span className="text-slate-600 font-medium">並び順:</span>
          <select
            value={sortMode}
            onChange={(event) =>
              setSortMode(
                event.target.value as 'deadline_asc' | 'deadline_desc' | 'start_desc' | 'start_asc'
              )
            }
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs"
          >
            <option value="deadline_asc">期限が近い順</option>
            <option value="deadline_desc">期限が遠い順</option>
            <option value="start_desc">公開日時が新しい順</option>
            <option value="start_asc">公開日時が古い順</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4">
        {filteredTests.map((test) => {
          const deadlineMeta = getDeadlineMeta(test);
          return (
            <div key={test.assignment_id} className="relative">
              <div
                className="bg-white shadow rounded-lg p-6 border-l-4 border-indigo-600 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setOverlayAssignmentId(test.assignment_id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setOverlayAssignmentId(test.assignment_id);
                  }
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-lg font-semibold text-slate-900">{test.title}</h2>
                      {getStatusBadge(test)}
                      {getPassBadge(test)}
                      <span className={`text-xs font-semibold ${deadlineMeta.tone}`}>
                        {deadlineMeta.label}
                      </span>
                    </div>
                  <p className="text-xs text-slate-700 font-medium">カードをタップして受験を開始できます</p>

                  {test.description && (
                    <p className="text-slate-600 text-sm">{test.description}</p>
                  )}

                  {test.announcement?.message && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      {test.announcement.message}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                    <div>
                      <span className="text-slate-700 font-medium">受験可能期間</span>
                      <div className="text-slate-900 font-medium">
                        {test.assignment_schedule_display ? (
                          <>
                            <div>{test.assignment_schedule_display.start_at || '未設定'}</div>
                            <div className="text-xs text-slate-500">〜</div>
                            <div>{test.assignment_schedule_display.end_at || '未設定'}</div>
                          </>
                        ) : test.assignment_schedule ? (
                          <>
                            <div>{new Date(test.assignment_schedule.start_at).toLocaleString('ja-JP')}</div>
                            <div className="text-xs text-slate-500">〜</div>
                            <div>{new Date(test.assignment_schedule.end_at).toLocaleString('ja-JP')}</div>
                          </>
                        ) : '期間不定'}
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-700 font-medium">最大受験回数</span>
                      <p className="text-slate-900 font-medium">{test.max_attempts}回</p>
                    </div>

                    <div>
                      <span className="text-slate-700 font-medium">残り受験回数</span>
                      <p className={`font-medium ${test.attempts_remaining > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {test.attempts_remaining}回
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-700 font-medium">合格基準 / 最高得点</span>
                      <p className="text-slate-900 font-medium">
                        {test.passing_percentage != null ? `${test.passing_percentage}%` : '-'} /{' '}
                        {test.best_score != null ? `${test.best_score}%` : '-'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="ml-4 flex flex-col gap-2">
                  {test.show_test_content !== false && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/student/tests/${test.assignment_id}`);
                      }}
                      className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-sm font-semibold"
                    >
                      テスト内容を見る
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/student/tests/${test.assignment_id}/result`);
                    }}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-sm font-semibold"
                  >
                    受験結果を見る
                  </button>
                </div>
              </div>
            </div>

              {overlayAssignmentId === test.assignment_id && (
                <div
                  className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center"
                  onClick={() => setOverlayAssignmentId(null)}
                >
                  <div
                    className="bg-white rounded-lg shadow-lg p-5 w-[90%] max-w-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="text-lg font-semibold text-slate-900 mb-3">受験を開始しますか？</div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => router.push(`/student/tests/${test.assignment_id}/attempt`)}
                        disabled={!test.is_available || test.attempts_remaining === 0}
                        className="flex-1 px-4 py-2 rounded-lg font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        style={
                          test.is_available && test.attempts_remaining > 0
                            ? { backgroundColor: '#4f46e5' }
                            : { backgroundColor: '#9ca3af' }
                        }
                      >
                        受験開始
                      </button>
                      <button
                        type="button"
                        onClick={() => setOverlayAssignmentId(null)}
                        className="flex-1 px-4 py-2 rounded-lg font-semibold bg-slate-200 text-slate-700 hover:bg-slate-300"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredTests.length === 0 && (
          <div className="bg-white shadow rounded-lg p-8 text-center text-slate-500">
            <p>条件に合うテストはありません。</p>
          </div>
        )}
      </div>
    </div>
  );
}
