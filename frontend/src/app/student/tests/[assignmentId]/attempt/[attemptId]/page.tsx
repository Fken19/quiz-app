'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { startAttempt, submitAnswers } from '@/lib/api/test';
import type {
  AttemptStartResponse,
  StudentTestQuestion,
  AnswerInput,
} from '@/types/test';

interface AttemptState {
  attemptId: string;
  testTitle: string;
  timerSeconds: number;
  questions: StudentTestQuestion[];
  currentQuestionIndex: number;
  selectedAnswers: Map<number, string | null>;  // question_order -> choice_id
  reactionTimes: Map<number, number>;  // question_order -> ms
  isSubmitting: boolean;
  error: string | null;
  announcement?: string | null;
}

export default function AttemptPage() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.assignmentId as string;
  const attemptIdParam = params.attemptId as string;

  const [state, setState] = useState<AttemptState | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const questionStartTimeRef = useRef<number>(0);
  const submitLockRef = useRef(false);

  // 受験開始（まだ開始されていない場合）
  useEffect(() => {
    const initializeAttempt = async () => {
      try {
        setIsLoading(true);

        let response: AttemptStartResponse | null = null;
        if (typeof window !== 'undefined') {
          const cached = sessionStorage.getItem(`attempt_start:${attemptIdParam}`);
          if (cached) {
            try {
              response = JSON.parse(cached) as AttemptStartResponse;
            } catch {
              response = null;
            }
            sessionStorage.removeItem(`attempt_start:${attemptIdParam}`);
          }
        }

        if (!response) {
          response = await startAttempt(assignmentId);
        }

        const initialState: AttemptState = {
          attemptId: response.attempt_id,
          testTitle: '',
          timerSeconds: response.timer_seconds,
          questions: response.questions,
          currentQuestionIndex: 0,
          selectedAnswers: new Map(),
          reactionTimes: new Map(),
          isSubmitting: false,
          error: null,
          announcement: response.announcement?.message || null,
        };

        setState(initialState);
        setTimeRemaining(response.timer_seconds);
        questionStartTimeRef.current = Date.now();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '受験開始に失敗しました';
        console.error('Error starting attempt:', err);
        setState(prev => prev ? { ...prev, error: errorMsg } : { error: errorMsg } as any);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAttempt();
  }, [assignmentId]);

  // タイマー
  useEffect(() => {
    if (!state || timeRemaining <= 0) return;

    timerIntervalRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [state, timeRemaining]);

  const handleTimeUp = async () => {
    if (!state || submitLockRef.current) return;
    // タイムアップ時は自動提出
    await handleSubmit();
  };

  const handleSelectChoice = (choiceId: string) => {
    if (!state) return;

    const question = state.questions[state.currentQuestionIndex];
    const reactionTime = Date.now() - questionStartTimeRef.current;

    setState(prev => {
      if (!prev) return prev;
      const newAnswers = new Map(prev.selectedAnswers);
      const newReactionTimes = new Map(prev.reactionTimes);

      newAnswers.set(question.question_order, choiceId);
      newReactionTimes.set(question.question_order, reactionTime);

      return {
        ...prev,
        selectedAnswers: newAnswers,
        reactionTimes: newReactionTimes,
      };
    });
  };

  const handleNextQuestion = () => {
    if (!state) return;

    if (state.currentQuestionIndex < state.questions.length - 1) {
      setState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          currentQuestionIndex: prev.currentQuestionIndex + 1,
        };
      });
      questionStartTimeRef.current = Date.now();
    }
  };

  const handlePreviousQuestion = () => {
    if (!state) return;

    if (state.currentQuestionIndex > 0) {
      setState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          currentQuestionIndex: prev.currentQuestionIndex - 1,
        };
      });
      questionStartTimeRef.current = Date.now();
    }
  };

  const handleSubmit = async () => {
    if (!state || state.isSubmitting || submitLockRef.current) return;

    submitLockRef.current = true;
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    setState(prev => {
      if (!prev) return prev;
      return { ...prev, isSubmitting: true };
    });

    try {
      const answers: AnswerInput[] = state.questions.map(q => ({
        question_order: q.question_order,
        choice_id: state.selectedAnswers.get(q.question_order) || null,
        reaction_time_ms: state.reactionTimes.get(q.question_order) || null,
      }));

      await submitAnswers(state.attemptId, { answers });

      // 結果ページへ遷移
      router.push(
        `/student/tests/${assignmentId}/attempt/${state.attemptId}/result/`
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '提出に失敗しました';
      console.error('Error submitting answers:', err);
      submitLockRef.current = false;
      setState(prev => {
        if (!prev) return prev;
        return { ...prev, error: errorMsg, isSubmitting: false };
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700">受験を開始中...</p>
        </div>
      </div>
    );
  }

  if (!state || state.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <h1 className="text-2xl font-bold text-red-600 mb-4">エラーが発生しました</h1>
          <p className="text-gray-700 mb-6">{state?.error || '不明なエラーが発生しました'}</p>
          <button
            onClick={() => router.push('/student/tests')}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            テスト一覧に戻る
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = state.questions[state.currentQuestionIndex];
  const currentChoices = currentQuestion?.vocabulary?.choices ?? [];
  const isAnswered = state.selectedAnswers.has(currentQuestion.question_order);
  const selectedChoiceId = state.selectedAnswers.get(currentQuestion.question_order);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-2xl font-bold">{state.testTitle || 'テスト受験'}</h1>
            <div className={`text-2xl font-bold ${
              timeRemaining < 60 ? 'text-red-600' : 'text-blue-600'
            }`}>
                ⏱ {formatTimer(timeRemaining)}
                <div className="text-xs text-gray-500 font-normal">制限時間（全体）</div>
            </div>
          </div>
          <div className="text-sm text-gray-900 font-semibold">
            問題 {state.currentQuestionIndex + 1} / {state.questions.length}
          </div>
          {state.announcement && (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {state.announcement}
            </div>
          )}
        </div>

        {/* 問題 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {currentQuestion.vocabulary.text_en}
          </h2>

          {/* 選択肢 */}
          <div className="space-y-2">
            {currentChoices.map(choice => (
              <label
                key={choice.id}
                className={`flex items-center p-3 border rounded cursor-pointer transition ${
                  selectedChoiceId === choice.id
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <input
                  type="radio"
                  name="choices"
                  value={choice.id}
                  checked={selectedChoiceId === choice.id}
                  onChange={() => handleSelectChoice(choice.id)}
                  className="mr-3"
                />
                <span className="text-lg text-gray-900 font-medium">{choice.text_ja}</span>
              </label>
            ))}
          </div>
        </div>

        {/* ナビゲーション */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={handlePreviousQuestion}
            disabled={state.currentQuestionIndex === 0}
            className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded disabled:opacity-50 hover:bg-gray-400"
          >
            ← 前の問題
          </button>

          {state.currentQuestionIndex < state.questions.length - 1 ? (
            <button
              onClick={handleNextQuestion}
              disabled={!isAnswered}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700"
            >
              次の問題 →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={state.isSubmitting || state.questions.some(
                q => !state.selectedAnswers.has(q.question_order)
              )}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50 hover:bg-green-700"
            >
              {state.isSubmitting ? '提出中...' : '提出'}
            </button>
          )}
        </div>

        {/* 進捗バー */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="mb-2 text-sm text-gray-900 font-semibold">回答状況</div>
          <div className="flex flex-wrap gap-2">
            {state.questions.map((q, idx) => {
              const isAnsweredQ = state.selectedAnswers.has(q.question_order);
              const isCurrent = idx === state.currentQuestionIndex;

              return (
                <button
                  key={q.question_order}
                  onClick={() => {
                    setState(prev => {
                      if (!prev) return prev;
                      return { ...prev, currentQuestionIndex: idx };
                    });
                    questionStartTimeRef.current = Date.now();
                  }}
                  className={`w-10 h-10 rounded font-semibold transition ${
                    isCurrent
                      ? 'bg-blue-600 text-white'
                      : isAnsweredQ
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
