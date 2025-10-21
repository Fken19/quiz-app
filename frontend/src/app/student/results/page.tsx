'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/api-utils';
import type { QuizResult, Quiz } from '@/types/quiz';

interface Row {
  result: QuizResult;
  quiz?: Quiz | null;
}

export default function QuizResultsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await apiGet('/api/quiz-results/');
        const results: QuizResult[] = Array.isArray(data) ? data : data?.results || [];

        const quizIds = Array.from(new Set(results.map((r) => r.quiz))).filter(Boolean) as string[];
        const quizzes = await Promise.all(
          quizIds.map((id) => apiGet(`/api/quizzes/${id}/`).catch(() => null)),
        );
        const quizMap = new Map<string, Quiz>();
        quizzes.forEach((quiz) => {
          if (quiz && 'quiz_id' in quiz) {
            quizMap.set(quiz.quiz_id, quiz as Quiz);
          }
        });

        setRows(results.map((result) => ({ result, quiz: quizMap.get(result.quiz) })));
      } catch (err) {
        console.error(err);
        setError('クイズ結果の取得に失敗しました');
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
          <h1 className="text-2xl font-bold text-slate-900">クイズ結果一覧</h1>
          <p className="text-slate-600">最新20件までの結果を表示します。</p>
        </div>
        <Link href="/student/dashboard" className="text-indigo-600 font-semibold">← ダッシュボードへ戻る</Link>
      </div>

      <div className="bg-white shadow rounded-lg divide-y">
        <div className="grid grid-cols-6 gap-4 px-6 py-3 text-sm font-semibold text-slate-500">
          <div>ID</div>
          <div>クイズ</div>
          <div>開始時刻</div>
          <div>終了時刻</div>
          <div>スコア</div>
          <div>詳細</div>
        </div>
        {rows.map(({ result, quiz }) => (
          <div key={result.quiz_result_id} className="grid grid-cols-6 gap-4 px-6 py-4 text-sm">
            <div className="text-slate-600 truncate">{result.quiz_result_id}</div>
            <div className="text-slate-600">{quiz?.title || quiz?.quiz_id || '---'}</div>
            <div className="text-slate-600">{new Date(result.started_at).toLocaleString()}</div>
            <div className="text-slate-600">{result.completed_at ? new Date(result.completed_at).toLocaleString() : '---'}</div>
            <div className="text-slate-600">{result.score ?? '---'}</div>
            <div>
              <Link href={`/student/results/${result.quiz_result_id}`} className="text-indigo-600 hover:underline">
                詳細
              </Link>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="px-6 py-8 text-center text-slate-500">
            クイズ結果がまだ登録されていません。
          </div>
        )}
      </div>
    </div>
  );
}
