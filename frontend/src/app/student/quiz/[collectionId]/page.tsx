'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiGet } from '@/lib/api-utils';
import type { Quiz, QuizCollection } from '@/types/quiz';

interface QuizRow {
  quiz: Quiz;
}

export default function CollectionDetailPage() {
  const params = useParams<{ collectionId: string }>();
  const router = useRouter();
  const [collection, setCollection] = useState<QuizCollection | null>(null);
  const [rows, setRows] = useState<QuizRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.collectionId) return;

    const fetchCollection = async () => {
      try {
        setLoading(true);
        const [collectionData, quizzesResponse] = await Promise.all([
          apiGet(`/api/quiz-collections/${params.collectionId}/`),
          apiGet(`/api/quizzes/?quiz_collection=${params.collectionId}&page_size=200`),
        ]);
        const quizList: Quiz[] = Array.isArray(quizzesResponse)
          ? quizzesResponse
          : quizzesResponse?.results || [];
        setCollection(collectionData as QuizCollection);
        setRows(quizList.map((quiz) => ({ quiz })));
      } catch (err) {
        console.error(err);
        setError('クイズ一覧の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchCollection();
  }, [params?.collectionId]);

  const pageTitle = useMemo(() => collection?.title ?? 'クイズ', [collection]);

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
        <button onClick={() => router.back()} className="mt-4 text-indigo-600 hover:underline">
          戻る
        </button>
      </div>
    );
  }

  if (!collection) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto py-10 space-y-6 px-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{pageTitle}</h1>
          <p className="text-slate-600 text-sm">セクションを選んで学習を始めましょう。</p>
        </div>
        <Link href="/student/quiz" className="text-indigo-600 font-semibold text-sm sm:text-base">← コレクション一覧へ戻る</Link>
      </div>

      <div className="bg-white shadow rounded-lg divide-y">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <span className="col-span-1">順番</span>
          <span className="col-span-1">タイトル</span>
          <span className="hidden sm:block">制限時間</span>
          <span className="col-span-1 text-sm sm:text-left sm:col-span-1">開始</span>
        </div>
        {rows.map(({ quiz }) => (
          <div key={quiz.quiz_id} className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-6 py-3 text-sm text-slate-700">
            <span>#{quiz.sequence_no}</span>
            <span className="font-semibold">{quiz.title ?? `セクション${quiz.sequence_no}`}</span>
            <span className="hidden sm:block">{quiz.timer_seconds ?? '---'} 秒</span>
            <span className="flex sm:block">
              <Link
                href={`/student/quiz/play?quizId=${quiz.quiz_id}`}
                className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-white text-sm font-semibold hover:bg-indigo-700"
              >
                プレイ
              </Link>
            </span>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="px-6 py-8 text-center text-slate-500">このコレクションにはクイズが登録されていません。</div>
        )}
      </div>
    </div>
  );
}
