'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/api-utils';
import type { QuizCollection, Quiz, QuizQuestion } from '@/types/quiz';

interface CollectionRow {
  collection: QuizCollection;
  quizzes: Array<{ quiz: Quiz; questionCount: number }>;
}

export default function QuizzesPage() {
  const [rows, setRows] = useState<CollectionRow[]>([]);
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

        const quizQuestions = await Promise.all(
          quizzes.flatMap((entry) => {
            const list: Quiz[] = Array.isArray(entry) ? entry : entry?.results || [];
            return list.map((quiz) =>
              apiGet(`/api/quiz-questions/?quiz=${quiz.quiz_id}&page_size=200`).catch(() => ({ results: [] })),
            );
          }),
        );

        let questionIndex = 0;
        const rowsData: CollectionRow[] = collections.map((collection, idx) => {
          const quizEntry = quizzes[idx];
          const quizList: Quiz[] = Array.isArray(quizEntry) ? quizEntry : quizEntry?.results || [];
          const quizRows = quizList.map((quiz) => {
            const questionEntry = quizQuestions[questionIndex++];
            const questionList: QuizQuestion[] = Array.isArray(questionEntry)
              ? questionEntry
              : questionEntry?.results || [];
            return { quiz, questionCount: questionList.length };
          });
          return {
            collection,
            quizzes: quizRows,
          };
        });

        setRows(rowsData);
      } catch (err) {
        console.error(err);
        setError('クイズ情報の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchCollections();
  }, []);

  const totalQuizzes = useMemo(() => rows.reduce((acc, row) => acc + row.quizzes.length, 0), [rows]);

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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">クイズコレクション</h1>
          <p className="text-slate-600 text-sm sm:text-base">全{rows.length}コレクション / {totalQuizzes}クイズ</p>
        </div>
        <Link href="/student/dashboard" className="text-indigo-600 font-semibold text-sm sm:text-base">← ダッシュボードへ戻る</Link>
      </div>

      {rows.map((row) => (
        <section key={row.collection.quiz_collection_id} className="bg-white shadow rounded-lg overflow-hidden">
          <header className="px-6 py-4 border-b flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{row.collection.title}</h2>
              <p className="text-sm text-slate-600">
                並び順: {row.collection.order_index} / スコープ: {row.collection.scope}{' '}
                {row.collection.is_published ? '(公開済み)' : '(非公開)'}
              </p>
              {row.collection.description && (
                <p className="text-xs text-slate-500 mt-1">{row.collection.description}</p>
              )}
            </div>
            <div className="text-sm text-slate-500">
              クイズ数: {row.quizzes.length}
            </div>
          </header>
          <div className="divide-y">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <span>タイトル</span>
              <span>順番</span>
              <span>制限時間</span>
              <span>開始</span>
            </div>
            {row.quizzes.map(({ quiz, questionCount }) => (
              <div key={quiz.quiz_id} className="grid grid-cols-1 sm:grid-cols-4 gap-4 px-6 py-3 text-sm text-slate-700">
                <span className="font-semibold">{quiz.title ?? `Quiz #${quiz.sequence_no}`}</span>
                <span>#{quiz.sequence_no}</span>
                <span>{quiz.timer_seconds ?? '---'} 秒・{questionCount}問</span>
                <span>
                  <Link
                    href={`/student/quiz/play?quizId=${quiz.quiz_id}`}
                    className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-white text-sm font-semibold hover:bg-indigo-700"
                  >
                    プレイ
                  </Link>
                </span>
              </div>
            ))}
            {row.quizzes.length === 0 && (
              <div className="px-6 py-6 text-sm text-slate-500">このコレクションにはクイズが登録されていません。</div>
            )}
          </div>
        </section>
      ))}

      {rows.length === 0 && (
        <div className="bg-white shadow rounded-lg px-6 py-10 text-center text-slate-600">
          クイズコレクションがまだ登録されていません。
        </div>
      )}
    </div>
  );
}
