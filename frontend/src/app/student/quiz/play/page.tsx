'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiGet, apiPost } from '@/lib/api-utils';
import type { Quiz, QuizQuestion, Vocabulary, VocabChoice, QuizResult, QuizResultDetail } from '@/types/quiz';
import LoadingSpinner from '@/components/LoadingSpinner';

interface QuizQuestionView {
  question: QuizQuestion;
  vocabulary: Vocabulary | null;
  choices: VocabChoice[];
}

interface QuizProgress {
  currentIndex: number;
  answers: Array<{
    question: QuizQuestionView;
    selectedChoiceId: string | null;
    selectedText: string | null;
    isCorrect: boolean;
    reactionTimeMs: number;
  }>;
  startedAt: number;
}

export default function QuizPlayPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quizId = searchParams?.get('quizId');

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestionView[]>([]);
  const [progress, setProgress] = useState<QuizProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedResult, setCompletedResult] = useState<QuizResult | null>(null);

  useEffect(() => {
    if (!quizId) {
      setError('クイズIDが指定されていません');
      setLoading(false);
      return;
    }

    const loadQuiz = async () => {
      try {
        setLoading(true);
        const quizData = (await apiGet(`/api/quizzes/${quizId}/`)) as Quiz;
        const questionResponse = await apiGet(`/api/quiz-questions/?quiz=${quizId}&page_size=200`);
        const questionList: QuizQuestion[] = Array.isArray(questionResponse)
          ? questionResponse
          : questionResponse?.results || [];

        const vocabularyIds = Array.from(new Set(questionList.map((q) => q.vocabulary)));
        const vocabularies = await Promise.all(
          vocabularyIds.map((id) => apiGet(`/api/vocabularies/${id}/`).catch(() => null)),
        );
        const vocabMap = new Map<string, Vocabulary>();
        vocabularies.forEach((vocab) => {
          if (vocab && 'vocabulary_id' in vocab) {
            vocabMap.set(vocab.vocabulary_id, vocab as Vocabulary);
          }
        });

        const choicesMatrix = await Promise.all(
          questionList.map((question) =>
            apiGet(`/api/vocab-choices/?vocabulary=${question.vocabulary}`).catch(() => ({ results: [] })),
          ),
        );

        const questionViews: QuizQuestionView[] = questionList
          .sort((a, b) => a.question_order - b.question_order)
          .map((question, index) => {
            const entry = choicesMatrix[index];
            const choices: VocabChoice[] = Array.isArray(entry) ? entry : entry?.results || [];
            return {
              question,
              vocabulary: vocabMap.get(question.vocabulary) ?? null,
              choices: shuffleChoices(choices),
            };
          });

        setQuiz(quizData);
        setQuestions(questionViews);
        setProgress({
          currentIndex: 0,
          answers: [],
          startedAt: Date.now(),
        });
      } catch (err) {
        console.error(err);
        setError('クイズ情報の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    loadQuiz();
  }, [quizId]);

  const currentQuestion = useMemo(() => {
    if (!progress) return null;
    return questions[progress.currentIndex] ?? null;
  }, [progress, questions]);

  const handleAnswer = (choice: VocabChoice) => {
    if (!progress || !currentQuestion) return;

    const endTime = Date.now();
    const reactionTime = endTime - progress.startedAt;
    const isCorrect = choice.is_correct;

    const newAnswers = [...progress.answers, {
      question: currentQuestion,
      selectedChoiceId: choice.vocab_choice_id,
      selectedText: choice.text_ja,
      isCorrect,
      reactionTimeMs: reactionTime,
    }];

    const nextIndex = progress.currentIndex + 1;

    if (nextIndex >= questions.length) {
      submitResults(newAnswers);
    } else {
      setProgress({
        currentIndex: nextIndex,
        answers: newAnswers,
        startedAt: Date.now(),
      });
    }
  };

  const submitResults = async (answers: QuizProgress['answers']) => {
    if (!quizId) return;
    try {
      setSubmitting(true);
      const completedAt = new Date();
      const correctCount = answers.filter((a) => a.isCorrect).length;
      const totalTime = answers.reduce((acc, item) => acc + item.reactionTimeMs, 0);

      const resultPayload = {
        quiz: quizId,
        completed_at: completedAt.toISOString(),
        total_time_ms: totalTime,
        score: correctCount,
      };

      const result = (await apiPost('/api/quiz-results/', resultPayload)) as QuizResult;

      await Promise.all(
        answers.map((answer, index) => {
          const detailPayload = {
            quiz_result: result.quiz_result_id,
            question_order: index + 1,
            vocabulary: answer.question.vocabulary?.vocabulary_id ?? answer.question.question.vocabulary,
            selected_text: answer.selectedText,
            is_correct: answer.isCorrect,
            reaction_time_ms: answer.reactionTimeMs,
          } satisfies Partial<QuizResultDetail>;

          return apiPost('/api/quiz-result-details/', detailPayload);
        }),
      );

      setCompletedResult({ ...result, score: correctCount, total_time_ms: totalTime, completed_at: completedAt.toISOString() });
      setProgress(null);
    } catch (err) {
      console.error(err);
      setError('結果の保存に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    if (!quizId) return;
    setCompletedResult(null);
    setProgress({ currentIndex: 0, answers: [], startedAt: Date.now() });
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
          <p className="text-slate-600">正解数: {completedResult.score} / {questions.length}</p>
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
          <p className="text-slate-600">問題 {progress.currentIndex + 1} / {questions.length}</p>
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
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-slate-700 hover:border-indigo-400 hover:bg-indigo-50"
              disabled={submitting}
            >
              {choice.text_ja}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function shuffleChoices<T>(choices: T[]): T[] {
  const result = [...choices];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
