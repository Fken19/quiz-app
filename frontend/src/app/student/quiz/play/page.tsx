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
}

interface QuizProgress {
  currentIndex: number;
  answers: Array<{
    question: QuizSessionQuestion;
    selectedChoiceId: string | null;
    selectedText: string | null;
    isCorrect: boolean;
    isTimeout: boolean;
    reactionTimeMs: number;
  }>;
  startedAt: number;
}

interface QuizSessionResponse {
  quiz_result_id: string;
  timer_seconds: number;
  questions: QuizSessionQuestion[];
  question_count: number;
}

interface AnswerResponse {
  is_correct: boolean;
  is_timeout: boolean;
  reaction_time_ms?: number | null;
  selected_text?: string | null;
}

export default function QuizPlayPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quizId = searchParams?.get('quizId');

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizSessionQuestion[]>([]);
  const [progress, setProgress] = useState<QuizProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedResult, setCompletedResult] = useState<QuizResult | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState<number>(10);

  const startSession = useCallback(async () => {
    if (!quizId) {
      setError('クイズIDが指定されていません');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSessionId(null);
      setCompletedResult(null);

      const [quizData, sessionResponse] = await Promise.all([
        apiGet(`/api/quizzes/${quizId}/`).catch(() => null),
        apiPost('/api/quiz-sessions/', { quiz: quizId }),
      ]);

      if (!quizData || !('quiz_id' in quizData)) {
        throw new Error('クイズ情報の取得に失敗しました');
      }

      const sessionData = sessionResponse as QuizSessionResponse;
      setQuiz(quizData as Quiz);
      setQuestions(sessionData.questions || []);
      setSessionId(sessionData.quiz_result_id);
      setTimerSeconds(sessionData.timer_seconds || (quizData.timer_seconds ?? 10) || 10);
      setProgress({
        currentIndex: 0,
        answers: [],
        startedAt: Date.now(),
      });
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
    if (!progress || !currentQuestion || !sessionId || submitting || answering) return;

    const endTime = Date.now();
    const reactionTime = endTime - progress.startedAt;

    try {
      setAnswering(true);
      const answerResponse = (await apiPost(`/api/quiz-sessions/${sessionId}/answer/`, {
        question_order: currentQuestion.question_order,
        choice_id: choice.vocab_choice_id,
        elapsed_ms: reactionTime,
      })) as AnswerResponse;

      const newAnswers = [
        ...progress.answers,
        {
          question: currentQuestion,
          selectedChoiceId: choice.vocab_choice_id,
          selectedText: choice.text_ja,
          isCorrect: answerResponse.is_correct,
          isTimeout: answerResponse.is_timeout,
          reactionTimeMs: answerResponse.reaction_time_ms ?? reactionTime,
        },
      ];

      const nextIndex = progress.currentIndex + 1;

      if (nextIndex >= questions.length) {
        await completeSession();
      } else {
        setProgress({
          currentIndex: nextIndex,
          answers: newAnswers,
          startedAt: Date.now(),
        });
      }
    } catch (err) {
      console.error(err);
      setError('回答の送信に失敗しました');
    } finally {
      setAnswering(false);
    }
  };

  const completeSession = async () => {
    if (!sessionId) return;
    try {
      setSubmitting(true);
      const result = (await apiPost(`/api/quiz-sessions/${sessionId}/complete/`, {})) as QuizResult;
      setCompletedResult(result);
      setProgress(null);
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

  if (!quiz || !questions.length || !sessionId) {
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
        <div className="flex gap-4">
          <Link
            href="/student/results"
            className="inline-flex items-center px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
          >
            結果一覧へ
          </Link>
          <button
            onClick={handleRetry}
            className="inline-flex items-center px-4 py-2 rounded-md border border-indigo-600 text-indigo-600 text-sm font-semibold hover:bg-indigo-50"
          >
            再挑戦
          </button>
        </div>
      </div>
    );
  }

  if (!progress || !currentQuestion) {
    return null;
  }

  const questionTitle = currentQuestion.vocabulary?.text_en ?? `Q${progress.currentIndex + 1}`;

  return (
    <div className="max-w-3xl mx-auto py-12 space-y-6 px-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{quiz.title ?? 'クイズ'}</h1>
          <p className="text-slate-600">
            問題 {progress.currentIndex + 1} / {questions.length} （1問{timerSeconds}秒）
          </p>
        </div>
        <Link href="/student/quiz" className="text-indigo-600 font-semibold">← コレクションに戻る</Link>
      </div>

      <section className="bg-white shadow rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">{questionTitle}</h2>
        {currentQuestion.vocabulary?.explanation && (
          <p className="text-sm text-slate-500">{currentQuestion.vocabulary.explanation}</p>
        )}

        <div className="grid gap-3">
          {currentQuestion.choices.map((choice) => (
            <button
              key={choice.vocab_choice_id}
              onClick={() => handleAnswer(choice)}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-50"
              disabled={submitting || answering}
            >
              {choice.text_ja}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
