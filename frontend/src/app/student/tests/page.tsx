'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/api-utils';
import type { Test, TestResult } from '@/types/quiz';

interface TestRow {
  test: Test;
  attempts: number;
}

export default function AssignedTestsPage() {
  const [rows, setRows] = useState<TestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTests = async () => {
      try {
        setLoading(true);
        const testResponse = await apiGet('/api/tests/?page_size=100').catch(() => ({ results: [] }));
        const tests: Test[] = Array.isArray(testResponse) ? testResponse : testResponse?.results || [];

        const attemptsResponse = await apiGet('/api/test-results/?page_size=200').catch(() => ({ results: [] }));
        const results: TestResult[] = Array.isArray(attemptsResponse) ? attemptsResponse : attemptsResponse?.results || [];
        const attemptMap = new Map<string, number>();
        results.forEach((result) => {
          attemptMap.set(result.test, (attemptMap.get(result.test) ?? 0) + 1);
        });

        setRows(
          tests.map((test) => ({
            test,
            attempts: attemptMap.get(test.test_id) ?? 0,
          })),
        );
      } catch (err) {
        console.error(err);
        setError('テスト情報の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchTests();
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
          <h1 className="text-2xl font-bold text-slate-900">割り当てテスト</h1>
          <p className="text-slate-600">締切や残り受験回数を確認できます。</p>
        </div>
        <Link href="/student/dashboard" className="text-indigo-600 font-semibold">← ダッシュボードへ戻る</Link>
      </div>

      <div className="bg-white shadow rounded-lg divide-y">
        <div className="grid grid-cols-4 gap-4 px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <span>テスト名</span>
          <span>締切</span>
          <span>最大受験回数</span>
          <span>受験済み回数</span>
        </div>
        {rows.map((row) => (
          <div key={row.test.test_id} className="grid grid-cols-4 gap-4 px-6 py-3 text-sm text-slate-700">
            <span>{row.test.title}</span>
            <span>{row.test.due_at ? new Date(row.test.due_at).toLocaleString() : '---'}</span>
            <span>{row.test.max_attempts_per_student}</span>
            <span>{row.attempts}</span>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="px-6 py-8 text-center text-slate-500">割り当てられたテストはありません。</div>
        )}
      </div>
    </div>
  );
}
