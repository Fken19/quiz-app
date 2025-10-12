'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/api-utils';
import type { TestResult, Test } from '@/types/quiz';

interface Row {
  result: TestResult;
  test?: Test | null;
}

export default function TestResultsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await apiGet('/api/test-results/');
        const results: TestResult[] = Array.isArray(data) ? data : data?.results || [];

        const testIds = Array.from(new Set(results.map((r) => r.test))).filter(Boolean) as string[];
        const tests = await Promise.all(testIds.map((id) => apiGet(`/api/tests/${id}/`).catch(() => null)));
        const testMap = new Map<string, Test>();
        tests.forEach((test) => {
          if (test && 'test_id' in test) {
            testMap.set(test.test_id, test as Test);
          }
        });

        setRows(results.map((result) => ({ result, test: testMap.get(result.test) })));
      } catch (err) {
        console.error(err);
        setError('テスト結果の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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
      <div className="max-w-3xl mx-auto py-10">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-10 space-y-6 px-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">テスト結果一覧</h1>
          <p className="text-slate-600">最新20件までの結果を表示します。</p>
        </div>
        <Link href="/dashboard" className="text-indigo-600 font-semibold">← ダッシュボードへ戻る</Link>
      </div>

      <div className="bg-white shadow rounded-lg divide-y">
        <div className="grid grid-cols-5 gap-4 px-6 py-3 text-sm font-semibold text-slate-500">
          <div>ID</div>
          <div>テスト</div>
          <div>試行回</div>
          <div>開始時刻</div>
          <div>スコア</div>
        </div>
        {rows.map(({ result, test }) => (
          <div key={result.test_result_id} className="grid grid-cols-5 gap-4 px-6 py-4 text-sm">
            <div className="text-slate-600 truncate">{result.test_result_id}</div>
            <div className="text-slate-600">{test?.title || test?.test_id || '---'}</div>
            <div className="text-slate-600">#{result.attempt_no}</div>
            <div className="text-slate-600">{new Date(result.started_at).toLocaleString()}</div>
            <div className="text-slate-600">{result.score ?? '---'}</div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="px-6 py-8 text-center text-slate-500">テスト結果がまだ登録されていません。</div>
        )}
      </div>
    </div>
  );
}
