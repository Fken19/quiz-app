'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiGet, apiPost } from '@/lib/api-utils';
import type { Quiz, QuizResult } from '@/types/quiz';
import LoadingSpinner from '@/components/LoadingSpinner';

interface ChoiceOption {
  vocab_choice_id: string;
  text_ja: string;
  is_correct?: boolean;
}

interface QuizSessionQuestion {
  quiz_question_id: string;
  question_order: number;
  vocabulary: {
    vocabulary_id: string;
    text_en: string;
    part_of_speech?: string | null;
    explanation?: string | null;
  };
  choices: ChoiceOption[];
  correct_choice_id?: string | null;
}

interface QuizProgress {
  currentIndex: number;
  startedAt: number;
}

type AnswerLog = {
  question: QuizSessionQuestion;
  selectedChoiceId: string | null;
  selectedText: string | null;
  isCorrect: boolean;
  isTimeout: boolean;
  reactionTimeMs: number;
};

type ResultDetailRow = {
  quiz_result_detail_id?: string | null;
  question_order: number;
  vocab_text_en: string | null;
  selected_text: string | null;
  correct_text: string | null;
  is_correct: boolean;
  reaction_time_ms: number | null;
};

type JudgeState =
  | null
  | {
      isCorrect: boolean;
      isTimeout: boolean;
      reactionTimeMs: number;
      selectedText: string | null;
    };

export default function QuizPlayPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quizId = searchParams?.get('quizId');

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizSessionQuestion[]>([]);
  const [progress, setProgress] = useState<QuizProgress | null>(null);
  const [answers, setAnswers] = useState<AnswerLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedResult, setCompletedResult] = useState<QuizResult | null>(null);
  const [completedDetails, setCompletedDetails] = useState<ResultDetailRow[]>([]);
  const [timerSeconds, setTimerSeconds] = useState<number>(10);
  const [timeLeftMs, setTimeLeftMs] = useState<number>(0);
  const [judge, setJudge] = useState<JudgeState>(null);
  const [nextQuizId, setNextQuizId] = useState<string | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);

  const startSession = useCallback(async () => {
    if (!quizId) {
      router.replace('/student/quiz');
      return;
    }
    if (quizId.includes('[object')) {
      console.warn('Invalid quizId detected in query params:', quizId);
      router.replace('/student/quiz');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setCompletedResult(null);
      setSessionStartedAt(null);

      const [quizData, sessionResponse] = await Promise.all([
        apiGet(`/api/quizzes/${quizId}/`).catch(() => null),
        apiGet(`/api/quiz-session-questions/?quiz=${quizId}`).catch(() => null),
      ]);

      if (!quizData || !('quiz_id' in quizData)) {
        throw new Error('クイズ情報の取得に失敗しました');
      }

      const sessionData = sessionResponse as any;
      setQuiz(quizData as Quiz);
      const qList: QuizSessionQuestion[] = sessionData?.questions || [];
      setQuestions(qList);
      const timer = sessionData?.timer_seconds || (quizData.timer_seconds ?? 10) || 10;
      setTimerSeconds(timer);
      setTimeLeftMs(timer * 1000);
      setProgress({
        currentIndex: 0,
        startedAt: Date.now(),
      });
      setSessionStartedAt(Date.now());
      setAnswers([]);

      if (quizData.quiz_collection) {
        const list = await apiGet(`/api/quizzes/?quiz_collection=${quizData.quiz_collection}&page_size=300`).catch(
          () => ({ results: [] }),
        );
        const quizzes: Quiz[] = Array.isArray(list) ? list : list?.results || [];
        const currentSeq = quizData.sequence_no;
        const nextQuiz = quizzes.find((q) => q.sequence_no === currentSeq + 1);
        if (nextQuiz) setNextQuizId(nextQuiz.quiz_id);
      }
    } catch (err) {
      console.error(err);
      setError('クイズの開始に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    startSession();
  }, [startSession]);

  const currentQuestion = useMemo(() => {
    if (!progress) return null;
    return questions[progress.currentIndex] ?? null;
  }, [progress, questions]);

  const handleAnswer = async (choice: ChoiceOption) => {
    if (!progress || !currentQuestion || submitting || answering || judge) return;

    const endTime = Date.now();
    const reactionTime = endTime - progress.startedAt;

    try {
      setAnswering(true);
      const fallbackCorrect = (currentQuestion.choices.find((c: any) => (c as any).is_correct) as any)
        ?.vocab_choice_id;
      const correctId = currentQuestion.correct_choice_id || fallbackCorrect || null;
      const isCorrect = correctId ? correctId === choice.vocab_choice_id : false;

      const newAnswer: AnswerLog = {
        question: currentQuestion,
        selectedChoiceId: choice.vocab_choice_id,
        selectedText: choice.text_ja,
        isCorrect,
        isTimeout: false,
        reactionTimeMs: reactionTime,
      };
      setAnswers((prev) => [...prev, newAnswer]);
      setJudge({
        isCorrect: newAnswer.isCorrect,
        isTimeout: newAnswer.isTimeout,
        reactionTimeMs: newAnswer.reactionTimeMs,
        selectedText: newAnswer.selectedText,
      });
    } catch (err) {
      console.error(err);
      setError('回答の送信に失敗しました');
    } finally {
      setAnswering(false);
    }
  };

  const handleTimeout = async () => {
    if (!progress || !currentQuestion || submitting || answering || judge) return;
    const timerMs = timerSeconds * 1000;
    try {
      setAnswering(true);
      const newAnswer: AnswerLog = {
        question: currentQuestion,
        selectedChoiceId: null,
        selectedText: null,
        isCorrect: false,
        isTimeout: true,
        reactionTimeMs: timerMs,
      };
      setAnswers((prev) => [...prev, newAnswer]);
      setJudge({
        isCorrect: newAnswer.isCorrect,
        isTimeout: newAnswer.isTimeout,
        reactionTimeMs: newAnswer.reactionTimeMs,
        selectedText: newAnswer.selectedText,
      });
    } catch (err) {
      console.error(err);
      setError('タイムアウト処理に失敗しました');
    } finally {
      setAnswering(false);
    }
  };

  const proceedNext = async () => {
    if (!progress || judge === null || submitting || answering) return;
    const nextIndex = progress.currentIndex + 1;
    setJudge(null);
    if (nextIndex >= questions.length) {
      await completeSession(answers);
      return;
    }
    setProgress({
      currentIndex: nextIndex,
      startedAt: Date.now(),
    });
    setTimeLeftMs(timerSeconds * 1000);
  };

  const completeSession = async (finalAnswers?: AnswerLog[]) => {
    const merged = finalAnswers ?? answers;
    if (merged.length !== questions.length) {
      setError('送信されていない回答があります。通信状態を確認して再試行してください。');
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        quiz_id: quizId,
        started_at: sessionStartedAt ? new Date(sessionStartedAt).toISOString() : undefined,
        completed_at: new Date().toISOString(),
        details: merged.map((a) => ({
          question_order: a.question.question_order,
          vocabulary_id: a.question.vocabulary.vocabulary_id,
          selected_text: a.selectedText,
          selected_choice_id: a.selectedChoiceId,
          is_correct: a.isCorrect,
          is_timeout: a.isTimeout,
          reaction_time_ms: a.reactionTimeMs,
        })),
      };
      const res = await apiPost('/api/quiz-results/submit-session/', payload);
      const qrId = res?.quiz_result_id || res?.quiz_result || null;
      const detailRows: ResultDetailRow[] =
        (res?.details as ResultDetailRow[]) ||
        merged.map((a) => ({
          quiz_result_detail_id: null,
          question_order: a.question.question_order,
          vocab_text_en: a.question.vocabulary.text_en,
          selected_text: a.selectedText,
          correct_text:
            a.question.choices.find((c: any) => (c as any).is_correct)?.text_ja || null,
          is_correct: a.isCorrect,
          reaction_time_ms: a.reactionTimeMs,
        }));
      setCompletedDetails(detailRows);
      setCompletedResult(
        ({
          quiz_result_id: qrId,
          quiz: quizId || '',
          started_at: payload.started_at || new Date().toISOString(),
          completed_at: payload.completed_at || new Date().toISOString(),
          question_count: merged.length,
          score: merged.filter((a) => a.isCorrect).length,
          total_time_ms: merged.reduce((sum, a) => sum + (a.reactionTimeMs || 0), 0),
          timeout_count: merged.filter((a) => a.isTimeout).length,
        } as unknown) as QuizResult,
      );
      setProgress(merged ? { currentIndex: merged.length, startedAt: Date.now() } : null);
      setAnswers(merged);
      setJudge(null);
    } catch (err) {
      console.error(err);
      setError('結果の保存に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    startSession();
  };

  useEffect(() => {
    if (!progress || judge || submitting || answering) return;
    setTimeLeftMs(timerSeconds * 1000);
  }, [progress?.currentIndex, timerSeconds, judge, submitting, answering]);

  useEffect(() => {
    if (!progress || judge || submitting || answering) return;
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = timerSeconds * 1000 - elapsed;
      setTimeLeftMs(Math.max(0, remaining));
      if (remaining <= 0) {
        clearInterval(interval);
        handleTimeout();
      }
    }, 10);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress?.currentIndex, judge, submitting, answering, timerSeconds]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto py-10">
        <p className="text-red-600">{error}</p>
        <div className="mt-4 space-x-4">
          <button
            onClick={() => router.back()}
            className="text-indigo-600 hover:underline"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  if (!quiz || !questions.length) {
    return (
      <div className="max-w-xl mx-auto py-10">
        <p className="text-slate-600">クイズに問題が登録されていません。</p>
      </div>
    );
  }

  if (completedResult) {
    return (
      <div className="max-w-xl mx-auto py-12 space-y-6 px-4">
        <h1 className="text-3xl font-bold text-slate-900">結果</h1>
        <section className="bg-white shadow rounded-lg p-6 space-y-2">
          <p className="text-slate-600">クイズ: {quiz.title ?? quiz.quiz_id}</p>
          <p className="text-slate-600">
            正解数: {completedResult.score ?? 0} / {completedResult.question_count ?? questions.length}
          </p>
          <p className="text-slate-600">合計時間: {(completedResult.total_time_ms ?? 0) / 1000}s</p>
        </section>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/student/results"
            className="inline-flex items-center px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
          >
            結果一覧へ
          </Link>
          {quiz.quiz_collection && (
            <Link
              href={`/student/quiz/${quiz.quiz_collection}`}
              className="inline-flex items-center px-4 py-2 rounded-md border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"
            >
              レベル一覧へ
            </Link>
          )}
          {nextQuizId && (
            <Link
              href={`/student/quiz/play?quizId=${nextQuizId}`}
              className="inline-flex items-center px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
            >
              次のセクションへ
            </Link>
          )}
          <button
            onClick={handleRetry}
            className="inline-flex items-center px-4 py-2 rounded-md border border-indigo-600 text-indigo-600 text-sm font-semibold hover:bg-indigo-50"
          >
            再挑戦
          </button>
        </div>
        <section className="bg-white shadow rounded-lg overflow-hidden">
          <div className="grid grid-cols-5 gap-3 px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <span>出題順</span>
            <span>英単語</span>
            <span>選択した解答</span>
            <span>正解の解答</span>
            <span>解答時間（秒）</span>
          </div>
          {completedDetails.map((row) => (
            <div
              key={`${row.quiz_result_detail_id || row.question_order}`}
              className="grid grid-cols-5 gap-3 px-4 py-3 text-sm text-slate-700 border-t border-slate-100 first:border-t-0"
            >
              <span>{row.question_order}</span>
              <span className={row.is_correct ? 'text-slate-900' : 'text-red-600'}>
                {row.vocab_text_en ?? ''}
              </span>
              <span className={row.is_correct ? 'text-slate-900' : 'text-red-600'}>
                {row.selected_text || '未解答'}
              </span>
              <span className={row.is_correct ? 'text-slate-900' : 'text-red-600'}>
                {row.correct_text || '---'}
              </span>
              <span>
                {row.reaction_time_ms != null ? `${(row.reaction_time_ms / 1000).toFixed(2)}秒` : '---'}
              </span>
            </div>
          ))}
          {completedDetails.length === 0 && (
            <div className="px-4 py-4 text-sm text-slate-500">詳細を取得できませんでした。</div>
          )}
        </section>
      </div>
    );
  }

  if (!progress || !currentQuestion) {
    return null;
  }

  const questionTitle = currentQuestion.vocabulary?.text_en ?? `Q${progress.currentIndex + 1}`;
  const timeRatio = Math.min(1, Math.max(0, timeLeftMs / (timerSeconds * 1000)));

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-6 px-4 relative">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">
          問題 {progress.currentIndex + 1} / {questions.length} （1問{timerSeconds}秒）
        </div>
        <Link href="/student/quiz" className="text-indigo-600 font-semibold text-sm">← コレクションに戻る</Link>
      </div>

      <section className="bg-white shadow rounded-lg p-6 space-y-6 relative">
        <div className="text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-wide">{questionTitle}</h2>
        </div>

        <div className="flex items-center justify-center gap-2">
          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-[width] duration-100"
              style={{ width: `${timeRatio * 100}%` }}
            />
          </div>
          <span className="text-sm text-slate-600 w-16 text-right">
            {(timeLeftMs / 1000).toFixed(2)}s
          </span>
        </div>

        <div className="grid gap-3">
          {currentQuestion.choices.map((choice) => (
            <button
              key={choice.vocab_choice_id}
              onClick={() => handleAnswer(choice)}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-4 text-left text-base sm:text-lg text-slate-800 hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-50"
              disabled={submitting || answering}
            >
              {choice.text_ja}
            </button>
          ))}
        </div>

        {judge && (
          <div
            className="fixed inset-0 bg-white/95 flex flex-col items-center justify-center gap-4 cursor-pointer z-20"
            onClick={proceedNext}
          >
            <div className="text-7xl sm:text-8xl">
              {judge.isTimeout ? '⏱' : judge.isCorrect ? '◯' : '×'}
            </div>
            <div className="text-2xl font-semibold text-slate-800">
              {judge.isTimeout ? '時間切れ' : judge.isCorrect ? '正解！' : '不正解'}
            </div>
            <div className="text-sm text-slate-600">
              画面をタップして次へ
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
