'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api-utils';
import type { Test, TestResult } from '@/types/quiz';

export default function TeacherDashboardPage() {
  const [pendingTests, setPendingTests] = useState<Test[]>([]);
  const [recentResults, setRecentResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const [testsResponse, resultsResponse] = await Promise.all([
          apiGet('/api/tests/?page_size=20'),
          apiGet('/api/test-results/?page_size=10').catch(() => ({ results: [] })),
        ]);
        const tests: Test[] = Array.isArray(testsResponse) ? testsResponse : testsResponse?.results || [];
        const results: TestResult[] = Array.isArray(resultsResponse)
          ? resultsResponse
          : resultsResponse?.results || [];

        setPendingTests(tests.filter((test) => !test.archived_at));
        setRecentResults(results);
      } catch (err) {
        console.error(err);
        setError('ダッシュボード情報の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-10">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">講師ダッシュボード</h1>
        <p className="text-slate-600">割当済みテストと提出状況のサマリを確認できます。</p>
      </header>

      <section className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-slate-900">進行中のテスト</h2>
        </div>
        <div className="divide-y">
          {pendingTests.slice(0, 5).map((test) => (
            <div key={test.test_id} className="px-6 py-4 text-sm text-slate-700">
              <p className="font-semibold">{test.title}</p>
              <p className="text-slate-500">締切: {test.due_at ? new Date(test.due_at).toLocaleString() : '設定なし'}</p>
            </div>
          ))}
          {pendingTests.length === 0 && (
            <div className="px-6 py-4 text-sm text-slate-500">進行中のテストはありません。</div>
          )}
        </div>
      </section>

      <section className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-slate-900">最新の提出</h2>
        </div>
        <div className="divide-y">
          {recentResults.map((result) => (
            <div key={result.test_result_id} className="px-6 py-3 text-sm text-slate-700 flex justify-between">
              <span>テストID: {result.test}</span>
              <span>スコア: {result.score ?? '---'}</span>
              <span>提出: {new Date(result.started_at).toLocaleString()}</span>
            </div>
          ))}
          {recentResults.length === 0 && (
            <div className="px-6 py-4 text-sm text-slate-500">提出履歴がまだありません。</div>
          )}
        </div>
      </section>
    </div>
  );
}
