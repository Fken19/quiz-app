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
  const resultReturnParam = params?.resultId
    ? encodeURIComponent(`/student/results/${params.resultId}`)
    : null;
  const vocabLinkFromResult = (vocabId?: string | null) => {
    if (!vocabId) return null;
    return resultReturnParam
      ? `/student/vocab/${vocabId}?fromResult=${resultReturnParam}`
      : `/student/vocab/${vocabId}`;
  };
  const [result, setResult] = useState<QuizResult | null>(null);
  const [rows, setRows] = useState<DetailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quizTitle, setQuizTitle] = useState<string>('クイズ');
  const [quizLevel, setQuizLevel] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.resultId) return;

    const fetchDetail = async () => {
      try {
        setLoading(true);
        const header = (await apiGet(`/api/quiz-results/${params.resultId}/`)) as QuizResult;
        const detailResponse = await apiGet(
          `/api/quiz-result-details/?quiz_result=${params.resultId}&page_size=200`,
        );
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
          const quizData = (await apiGet(`/api/quizzes/${header.quiz}/`).catch(() => null)) as Quiz | null;
          if (quizData) {
            setQuizTitle(quizData.title ?? 'クイズ');
            if (quizData.quiz_collection) {
              const collection = await apiGet(`/api/quiz-collections/${quizData.quiz_collection}/`).catch(() => null);
              if (collection && 'level_label' in collection) {
                const label = (collection as any).level_label || (collection as any).level_code;
                setQuizLevel(label ?? null);
              }
            }
          }
        }
        const uniqueDetails = Array.from(
          new Map(details.map((d) => [d.quiz_result_detail_id, d])).values(),
        );
        const limit = header?.question_count || uniqueDetails.length;
        // 最新セッション分を末尾から取得したうえで設問順に並べ替え
        const latestSessionDetails = uniqueDetails.slice(-limit);
        const orderedDetails = [...latestSessionDetails].sort((a, b) => a.question_order - b.question_order);
        setRows(orderedDetails.map((detail) => ({ detail, vocabulary: vocabMap.get(detail.vocabulary) })));
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

  const totalQuestions = result.question_count ?? rows.length;
  const correctCount = result.score ?? rows.filter((row) => row.detail.is_correct).length;
  const totalTimeMs = rows.reduce((sum, row) => sum + (row.detail.reaction_time_ms ?? 0), 0);
  const averageTimeSec = rows.length > 0 ? (totalTimeMs / 1000 / rows.length).toFixed(2) : null;
  const finishedAt = result.completed_at ? new Date(result.completed_at).toLocaleString() : null;
  const levelDisplay = quizLevel ? (quizLevel.startsWith('レベル') ? quizLevel : `レベル${quizLevel}`) : null;

  return (
    <div className="max-w-4xl mx-auto py-10 space-y-6 px-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">クイズ結果詳細</h1>
        </div>
        <Link href="/student/results" className="text-indigo-600 font-semibold">← 一覧へ戻る</Link>
      </div>

      <section className="bg-white shadow rounded-lg border border-slate-100 px-5 py-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-lg font-semibold text-slate-900">
            {levelDisplay ? `${levelDisplay} ` : ''}
            {quizTitle}
          </p>
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 text-indigo-700 px-4 py-1.5 text-sm font-semibold">
            スコア <span className="text-base">{`${correctCount} / ${totalQuestions || '---'}`}</span>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-slate-500">平均解答時間</span>
            <span className="text-sm font-semibold text-slate-900">{averageTimeSec ? `${averageTimeSec}秒` : '---'}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-slate-500">解答時刻</span>
            <span className="text-sm font-semibold text-slate-900">{finishedAt ?? '---'}</span>
          </div>
        </div>
      </section>

      <section className="bg-white shadow rounded-lg overflow-hidden">
        <div className="grid grid-cols-5 gap-4 px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <span>出題順</span>
          <span>英単語</span>
          <span>選択した解答</span>
          <span>正解の解答</span>
          <span>解答時間（秒）</span>
        </div>
        {rows.map((row) => (
          <div
            key={row.detail.quiz_result_detail_id}
            onClick={() => {
              const vid = row.vocabulary?.vocabulary_id || row.detail.vocabulary;
              const link = vocabLinkFromResult(vid);
              if (link) {
                router.push(link);
              }
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                const vid = row.vocabulary?.vocabulary_id || row.detail.vocabulary;
                const link = vocabLinkFromResult(vid);
                if (link) {
                  e.preventDefault();
                  router.push(link);
                }
              }
            }}
            className="grid grid-cols-5 gap-4 px-6 py-3 text-sm text-slate-700 border-t border-slate-100 first:border-t-0 cursor-pointer hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <span>{row.detail.question_order}</span>
            <span className={row.detail.is_correct ? 'text-slate-900' : 'text-red-600'}>
              {row.vocabulary?.text_en ?? row.detail.vocabulary}
            </span>
            <span>{row.detail.selected_text || '未解答'}</span>
            <span className={row.detail.is_correct ? 'text-slate-900' : 'text-red-600'}>
              {row.detail.correct_text || '---'}
            </span>
            <span>
              {row.detail.reaction_time_ms != null
                ? `${(row.detail.reaction_time_ms / 1000).toFixed(2)}秒`
                : '---'}
            </span>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="px-6 py-6 text-sm text-slate-500">解答詳細が見つかりませんでした。</div>
        )}
      </section>
    </div>
  );
}
