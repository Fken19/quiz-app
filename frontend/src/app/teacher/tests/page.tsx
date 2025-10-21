'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/api-utils';
import type { Test } from '@/types/quiz';

export default function TeacherTestsPage() {
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTests = async () => {
      try {
        setLoading(true);
        const response = await apiGet('/api/tests/?page_size=200').catch(() => ({ results: [] }));
        const list: Test[] = Array.isArray(response) ? response : response?.results || [];
        setTests(list);
      } catch (err) {
        console.error(err);
        setError('テスト一覧の取得に失敗しました');
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
      <div className="max-w-4xl mx-auto py-10">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">テスト一覧</h1>
          <p className="text-slate-600">下書き・公開済みテストを確認します。</p>
        </div>
        <Link
          href="#"
          className="inline-flex items-center px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
        >
          新しいテストを作成（準備中）
        </Link>
      </div>

      <div className="bg-white shadow rounded-lg divide-y">
        <div className="grid grid-cols-5 gap-4 px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <span>ID</span>
          <span>タイトル</span>
          <span>締切</span>
          <span>最大受験回数</span>
          <span>状態</span>
        </div>
        {tests.map((test) => (
          <div key={test.test_id} className="grid grid-cols-5 gap-4 px-6 py-3 text-sm text-slate-700">
            <span className="truncate">{test.test_id}</span>
            <span>{test.title}</span>
            <span>{test.due_at ? new Date(test.due_at).toLocaleString() : '設定なし'}</span>
            <span>{test.max_attempts_per_student}</span>
            <span>{test.archived_at ? 'アーカイブ済み' : '公開中'}</span>
          </div>
        ))}
        {tests.length === 0 && (
          <div className="px-6 py-6 text-sm text-slate-500">テストが登録されていません。</div>
        )}
      </div>
    </div>
  );
}
