'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiGet } from '@/lib/api-utils';
import type { Quiz, QuizResult, QuizResultDetail, Vocabulary } from '@/types/quiz';

interface DetailRow {
  detail: QuizResultDetail;
  vocabulary?: Vocabulary | null;
}

export default function QuizResultDetailPage() {
  const params = useParams<{ resultId: string }>();
  const router = useRouter();
  const [result, setResult] = useState<QuizResult | null>(null);
  const [rows, setRows] = useState<DetailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quizTitle, setQuizTitle] = useState<string>('クイズ');

  useEffect(() => {
    if (!params?.resultId) return;

    const fetchDetail = async () => {
      try {
        setLoading(true);
        const header = (await apiGet(`/api/quiz-results/${params.resultId}/`)) as QuizResult;
        const detailResponse = await apiGet(`/api/quiz-result-details/?quiz_result=${params.resultId}`);
        const details: QuizResultDetail[] = Array.isArray(detailResponse)
          ? detailResponse
          : detailResponse?.results || [];

        const vocabIds = Array.from(new Set(details.map((d) => d.vocabulary))).filter(Boolean) as string[];
        const vocabList = await Promise.all(
          vocabIds.map((id) => apiGet(`/api/vocabularies/${id}/`).catch(() => null)),
        );
        const vocabMap = new Map<string, Vocabulary>();
        vocabList.forEach((vocab) => {
          if (vocab && 'vocabulary_id' in vocab) {
            vocabMap.set(vocab.vocabulary_id, vocab as Vocabulary);
          }
        });

        setResult(header);
        // クイズタイトルを取得
        if (header && header.quiz) {
          const quizData = await apiGet(`/api/quizzes/${header.quiz}/`).catch(() => null);
          if (quizData && 'title' in quizData) {
            setQuizTitle((quizData as Quiz).title ?? 'クイズ');
          }
        }
        setRows(details.map((detail) => ({ detail, vocabulary: vocabMap.get(detail.vocabulary) })));
      } catch (err) {
        console.error(err);
        setError('結果詳細の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [params?.resultId]);

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
        <button
          onClick={() => router.back()}
          className="mt-4 text-indigo-600 hover:underline"
        >
          戻る
        </button>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  const correctCount = rows.filter((row) => row.detail.is_correct).length;

  return (
    <div className="max-w-4xl mx-auto py-10 space-y-6 px-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">クイズ結果詳細</h1>
          <p className="text-slate-600 text-sm">{quizTitle}</p>
        </div>
        <Link href="/student/results" className="text-indigo-600 font-semibold">← 一覧へ戻る</Link>
      </div>

      <section className="bg-white shadow rounded-lg p-6 space-y-2">
        <p className="text-slate-600">開始: {new Date(result.started_at).toLocaleString()}</p>
        <p className="text-slate-600">
          終了: {result.completed_at ? new Date(result.completed_at).toLocaleString() : '---'}
        </p>
        <p className="text-slate-600">スコア: {result.score ?? correctCount} / {rows.length}</p>
      </section>

      <section className="bg-white shadow rounded-lg overflow-hidden">
        <div className="grid grid-cols-5 gap-4 px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <span>#</span>
          <span>英単語</span>
          <span>選択した解答</span>
          <span>正誤</span>
          <span>反応時間(ms)</span>
        </div>
        {rows.map((row) => (
          <div key={row.detail.quiz_result_detail_id} className="grid grid-cols-5 gap-4 px-6 py-3 text-sm text-slate-700">
            <span>{row.detail.question_order}</span>
            <span>{row.vocabulary?.text_en ?? row.detail.vocabulary}</span>
            <span>{row.detail.selected_text ?? '---'}</span>
            <span className={row.detail.is_correct ? 'text-green-600' : 'text-red-600'}>
              {row.detail.is_correct ? '○' : '×'}
            </span>
            <span>{row.detail.reaction_time_ms ?? '---'}</span>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="px-6 py-6 text-sm text-slate-500">解答詳細が見つかりませんでした。</div>
        )}
      </section>
    </div>
  );
}
