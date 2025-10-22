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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{pageTitle}</h1>
          <p className="text-slate-600">コレクションID: {collection.quiz_collection_id}</p>
        </div>
        <Link href="/student/quiz" className="text-indigo-600 font-semibold">← コレクション一覧へ戻る</Link>
      </div>

      <div className="bg-white shadow rounded-lg divide-y">
        <div className="grid grid-cols-4 gap-4 px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <span>順番</span>
          <span>タイトル</span>
          <span>制限時間</span>
          <span>開始</span>
        </div>
        {rows.map(({ quiz }) => (
          <div key={quiz.quiz_id} className="grid grid-cols-4 gap-4 px-6 py-3 text-sm text-slate-700">
            <span>{quiz.sequence_no}</span>
            <span>{quiz.title ?? `Quiz #${quiz.sequence_no}`}</span>
            <span>{quiz.timer_seconds ?? '---'} 秒</span>
            <span>
              <Link
                href={`/student/quiz/play?quizId=${quiz.quiz_id}`}
                className="text-indigo-600 hover:underline"
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
