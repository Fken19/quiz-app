'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getStudentTests } from '@/lib/api/test';
import type { AvailableTest } from '@/types/test';

export default function AssignedTestsPage() {
  const router = useRouter();
  const [tests, setTests] = useState<AvailableTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const getStatusBadge = (test: AvailableTest) => {
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

  return (
    <div className="max-w-5xl mx-auto py-10 space-y-6 px-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">割り当てテスト</h1>
          <p className="text-slate-600">受験可能なテストが一覧表示されます。</p>
        </div>
        <Link href="/student/dashboard" className="text-indigo-600 font-semibold">← ダッシュボードへ戻る</Link>
      </div>

      <div className="grid gap-4">
        {tests.map((test) => (
          <div
            key={test.assignment_id}
            className="bg-white shadow rounded-lg p-6 border-l-4 border-indigo-600 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-lg font-semibold text-slate-900">{test.title}</h2>
                  {getStatusBadge(test)}
                </div>
                
                {test.description && (
                  <p className="text-slate-600 text-sm mb-3">{test.description}</p>
                )}

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">受験可能期間</span>
                    <p className="text-slate-900 font-medium">
                      {test.assignment_schedule ? (
                        <>
                          <div>{new Date(test.assignment_schedule.start_at).toLocaleString('ja-JP')}</div>
                          <div className="text-xs text-slate-500">〜</div>
                          <div>{new Date(test.assignment_schedule.end_at).toLocaleString('ja-JP')}</div>
                        </>
                      ) : '期間不定'}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-500">最大受験回数</span>
                    <p className="text-slate-900 font-medium">{test.max_attempts}回</p>
                  </div>

                  <div>
                    <span className="text-slate-500">残り受験回数</span>
                    <p className={`font-medium ${test.attempts_remaining > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {test.attempts_remaining}回
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => router.push(`/student/tests/${test.assignment_id}`)}
                disabled={!test.is_available || test.attempts_remaining === 0}
                className="ml-4 px-4 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={
                  test.is_available && test.attempts_remaining > 0
                    ? { backgroundColor: '#4f46e5', color: 'white' }
                    : { backgroundColor: '#e5e7eb', color: '#6b7280' }
                }
              >
                詳細を見る
              </button>
            </div>
          </div>
        ))}

        {tests.length === 0 && (
          <div className="bg-white shadow rounded-lg p-8 text-center text-slate-500">
            <p>割り当てられたテストはありません。</p>
          </div>
        )}
      </div>
    </div>
  );
}
