'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/api-utils';
import type { QuizCollection, Quiz } from '@/types/quiz';

export default function QuizzesPage() {
  const [levels, setLevels] = useState<Array<{ collection: QuizCollection; quizCount: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCollections = async () => {
      try {
        setLoading(true);
        setError(null);

        const collectionResponse = await apiGet('/api/quiz-collections/?page_size=50');
        const collections: QuizCollection[] = Array.isArray(collectionResponse)
          ? collectionResponse
          : collectionResponse?.results || [];

        const quizzes = await Promise.all(
          collections.map((collection) =>
            apiGet(`/api/quizzes/?quiz_collection=${collection.quiz_collection_id}&page_size=200`).catch(
              () => ({ results: [] }),
            ),
          ),
        );

        const rowsData = collections.map((collection, idx) => {
          const quizEntry = quizzes[idx];
          const quizList: Quiz[] = Array.isArray(quizEntry) ? quizEntry : quizEntry?.results || [];
          return {
            collection,
            quizCount: quizList.length,
          };
        });

        setLevels(rowsData);
      } catch (err) {
        console.error(err);
        setError('クイズ情報の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchCollections();
  }, []);

  const totalQuizzes = useMemo(() => levels.reduce((acc, row) => acc + row.quizCount, 0), [levels]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-10 px-4">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-10 space-y-6 px-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">クイズを選ぶ</h1>
          <p className="text-slate-600 text-sm sm:text-base">まずはレベルを選択してください</p>
          <p className="text-xs text-slate-500">STEP 1 / 2　レベル選択 → クイズ選択</p>
        </div>
        <Link href="/student/dashboard" className="text-indigo-600 font-semibold text-sm sm:text-base">← ダッシュボードへ戻る</Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {levels.map((row) => {
          const levelLabel = row.collection.level_label || row.collection.title || 'レベル';
          const description = row.collection.description || 'このレベルのクイズに挑戦しましょう。';
          return (
            <Link
              key={row.collection.quiz_collection_id}
              href={`/student/quiz/level/${row.collection.quiz_collection_id}`}
              role="button"
              className="bg-white shadow rounded-xl border border-slate-100 p-5 flex flex-col gap-3 hover:shadow-md active:scale-[0.98] transition cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-indigo-600">{levelLabel}</p>
                  <p className="text-base font-bold text-slate-900">{row.collection.title}</p>
                  <p className="text-sm text-slate-600">{description}</p>
                </div>
                <span className="text-xs text-slate-500">クイズ数: {row.quizCount}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {levels.length === 0 && (
        <div className="bg-white shadow rounded-lg px-6 py-10 text-center text-slate-600">
          クイズコレクションがまだ登録されていません。
        </div>
      )}
    </div>
  );
}
