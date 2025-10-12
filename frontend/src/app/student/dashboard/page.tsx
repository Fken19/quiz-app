'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiGet } from '@/lib/api-utils';
import type { ApiUser, QuizResult, TestResult, Vocabulary } from '@/types/quiz';

interface DashboardSummary {
  user: ApiUser | null;
  quizResultCount: number;
  testResultCount: number;
  vocabularyCount: number;
}

const initialSummary: DashboardSummary = {
  user: null,
  quizResultCount: 0,
  testResultCount: 0,
  vocabularyCount: 0,
};

export default function DashboardPage() {
  const { status, data } = useSession();
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary>(initialSummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (!data) {
      router.push('/auth/signin');
      return;
    }

    const fetchSummary = async () => {
      try {
        setLoading(true);
        setError(null);

        const [user, quizResults, testResults, vocabularies] = await Promise.all([
          apiGet('/api/users/me/').catch(() => null),
          apiGet('/api/quiz-results/').catch(() => ({ results: [] })),
          apiGet('/api/test-results/').catch(() => ({ results: [] })),
          apiGet('/api/vocabularies/?page_size=1').catch(() => ({ count: 0 })),
        ]);

        const parsedQuizResults: QuizResult[] = Array.isArray(quizResults)
          ? quizResults
          : Array.isArray(quizResults?.results)
          ? quizResults.results
          : [];

        const parsedTestResults: TestResult[] = Array.isArray(testResults)
          ? testResults
          : Array.isArray(testResults?.results)
          ? testResults.results
          : [];

        const vocabCount: number =
          typeof vocabularies?.count === 'number'
            ? vocabularies.count
            : Array.isArray(vocabularies)
            ? (vocabularies as Vocabulary[]).length
            : 0;

        setSummary({
          user: user as ApiUser | null,
          quizResultCount: parsedQuizResults.length,
          testResultCount: parsedTestResults.length,
          vocabularyCount: vocabCount,
        });
      } catch (err: unknown) {
        console.error(err);
        setError('ダッシュボード情報の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [status, data, router]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="max-w-5xl mx-auto py-12 space-y-10 px-4">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">ダッシュボード</h1>
        <p className="mt-2 text-slate-600">
          新しいクイズ / テスト スキーマのリソースを確認できます。
        </p>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-sm font-semibold text-slate-500">ログインユーザー</h2>
          <p className="mt-3 text-xl font-bold text-slate-900">
            {summary.user?.email ?? '---'}
          </p>
          <p className="mt-1 text-sm text-slate-500">ID: {summary.user?.user_id ?? '---'}</p>
        </div>
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-sm font-semibold text-slate-500">クイズ結果</h2>
          <p className="mt-3 text-xl font-bold text-slate-900">{summary.quizResultCount}</p>
          <Link href="/student/results" className="mt-2 inline-flex text-indigo-600 text-sm font-semibold">
            詳細を見る →
          </Link>
        </div>
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-sm font-semibold text-slate-500">テスト結果</h2>
          <p className="mt-3 text-xl font-bold text-slate-900">{summary.testResultCount}</p>
          <Link href="/student/tests" className="mt-2 inline-flex text-indigo-600 text-sm font-semibold">
            詳細を見る →
          </Link>
        </div>
      </section>

      <section className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-slate-900">語彙リソース</h2>
        <p className="mt-2 text-slate-600">
          登録済みの語彙数: <span className="font-semibold">{summary.vocabularyCount}</span>
        </p>
        <div className="mt-4">
          <Link
            href="/student/vocab"
            className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded hover:bg-indigo-700"
          >
            語彙一覧を見る
          </Link>
        </div>
      </section>
    </div>
  );
}
