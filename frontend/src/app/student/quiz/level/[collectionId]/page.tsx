'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api-utils';
import type { Quiz, QuizCollection, QuizQuestion } from '@/types/quiz';

interface QuizRow {
  quiz: Quiz;
  questionCount: number;
}

const buildOptions = (min: number, max: number, step: number) => {
  const list: number[] = [];
  for (let v = min; v <= max; v += step) {
    list.push(v);
  }
  if (list[list.length - 1] !== max) list.push(max);
  return Array.from(new Set(list)).sort((a, b) => a - b);
};

export default function QuizLevelDetailPage() {
  const params = useParams<{ collectionId: string }>();
  const router = useRouter();
  const collectionId = params?.collectionId;

  const [collection, setCollection] = useState<QuizCollection | null>(null);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [randomModal, setRandomModal] = useState(false);
  const [focusModal, setFocusModal] = useState(false);
  const [randomSelection, setRandomSelection] = useState<number>(10);
  const [focusSelection, setFocusSelection] = useState<number>(10);
  const [focusIds, setFocusIds] = useState<string[]>([]);
  const [focusLoading, setFocusLoading] = useState(false);
  const [startingRandom, setStartingRandom] = useState(false);
  const [startingFocus, setStartingFocus] = useState(false);

  // 必ず呼ばれる位置にフックを配置し、ローディング時は空配列で安全に計算する
  const totalQuestions = useMemo(() => (quizzes || []).reduce((sum, r) => sum + r.questionCount, 0), [quizzes]);
  const randomOptions = useMemo(() => {
    const max = Math.max(totalQuestions, 10);
    return buildOptions(Math.min(10, max), max, 10);
  }, [totalQuestions]);
  const focusTotal = focusIds.length;
  const focusOptions = useMemo(() => {
    if (focusTotal === 0) return [];
    const min = focusTotal >= 10 ? 10 : 1;
    const step = focusTotal >= 10 ? 5 : 1;
    return buildOptions(min, focusTotal, step);
  }, [focusTotal]);

  useEffect(() => {
    if (!collectionId) return;
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const collectionRes = (await apiGet(`/api/quiz-collections/${collectionId}/`).catch(() => null)) as
          | QuizCollection
          | null;
        if (!collectionRes) {
          throw new Error('コレクションが見つかりませんでした');
        }

        const quizzesRes = await apiGet(`/api/quizzes/?quiz_collection=${collectionId}&page_size=200`).catch(() => ({
          results: [],
        }));
        const quizList: Quiz[] = Array.isArray(quizzesRes) ? quizzesRes : quizzesRes?.results || [];
        // 即席クイズ（ランダム/フォーカス）は一覧から除外
        const filteredQuizList = quizList.filter(
          (q) => !(q.title?.startsWith('[RANDOM]') || q.title?.startsWith('[FOCUS]')),
        );

        const questionResponses = await Promise.all(
          filteredQuizList.map((quiz) =>
            apiGet(`/api/quiz-questions/?quiz=${quiz.quiz_id}&page_size=200`).catch(() => ({ results: [] })),
          ),
        );
        const rows: QuizRow[] = filteredQuizList.map((quiz, idx) => {
          const questionEntry = questionResponses[idx];
          const questionList: QuizQuestion[] = Array.isArray(questionEntry) ? questionEntry : questionEntry?.results || [];
          return { quiz, questionCount: questionList.length };
        });

        setCollection(collectionRes);
        setQuizzes(rows);
        const totalQuestions = rows.reduce((sum, r) => sum + r.questionCount, 0);
        setRandomSelection(totalQuestions > 0 ? totalQuestions : 10);
      } catch (err) {
        console.error(err);
        setError('レベル詳細の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [collectionId]);

  useEffect(() => {
    const fetchFocus = async () => {
      if (!collectionId) return;
      try {
        setFocusLoading(true);
        const focusRes = await apiGet(`/api/focus-questions/?level_id=${collectionId}&limit=100`).catch(() => null);
        const ids: string[] =
          (focusRes && Array.isArray(focusRes.vocabulary_ids) && focusRes.vocabulary_ids) ||
          (Array.isArray(focusRes?.results) ? focusRes.results : []);
        setFocusIds(ids);
        if (ids.length > 0) {
          setFocusSelection(ids.length);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setFocusLoading(false);
      }
    };
    fetchFocus();
  }, [collectionId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="max-w-4xl mx-auto py-10 px-4 space-y-4">
        <p className="text-red-600">{error || 'データが見つかりませんでした'}</p>
        <button onClick={() => router.back()} className="text-indigo-600 font-semibold hover:underline text-sm">
          ← 戻る
        </button>
      </div>
    );
  }

  const levelLabel = collection.level_label || collection.title || 'レベル';
  const description = collection.description || 'このレベルのクイズを選んでください。';
  const quizCount = quizzes.length;
  const representativeQuiz = quizzes[0]?.quiz;
  const representativeQuestions = quizzes[0]?.questionCount ?? null;
  const timePerQuestion = representativeQuiz?.timer_seconds ?? null;
  const levelId = collection.quiz_collection_id;
  const startRandomSession = async () => {
    try {
      setStartingRandom(true);
      if (!levelId) {
        setError('レベルIDの取得に失敗しました');
        return;
      }
      const payload = { mode: 'random', level_id: levelId, count: Number(randomSelection) };
      const res = await apiPost('/api/quiz-sessions/', payload).catch((e) => {
        console.error(e);
        return null;
      });
      const quizId =
        typeof res?.quiz_id === 'string'
          ? res.quiz_id
          : typeof res?.quiz?.quiz_id === 'string'
            ? res.quiz.quiz_id
            : typeof res?.quiz === 'string'
              ? res.quiz
              : typeof res?.id === 'string'
                ? res.id
                : null;
      if (quizId) {
        router.push(`/student/quiz/play?quizId=${quizId}&mode=random`);
      } else {
        setError(res?.detail || 'ランダム演習の開始に失敗しました');
      }
    } catch (err) {
      console.error(err);
      setError('ランダム演習の開始に失敗しました');
    } finally {
      setStartingRandom(false);
      setRandomModal(false);
    }
  };

  const startFocusSession = async () => {
    if (focusTotal === 0) {
      alert('フォーカス学習の対象となる問題がありません。まずは通常モードでクイズに取り組んでください。');
      return;
    }
    try {
      setStartingFocus(true);
      if (!levelId) {
        setError('レベルIDの取得に失敗しました');
        return;
      }
      const shuffled = [...focusIds].sort(() => Math.random() - 0.5);
      const selectedIds = shuffled.slice(0, Math.min(focusSelection, focusTotal));
      // backend expects either quiz (existing) or will create one when count is provided; ensure count>0
      if (selectedIds.length === 0) {
        setError('フォーカス学習の開始に失敗しました(対象なし)');
        return;
      }
      const payload = {
        mode: 'focus',
        level_id: levelId,
        count: Number(selectedIds.length),
        vocabulary_ids: selectedIds,
      };
      const res = await apiPost('/api/quiz-sessions/', payload).catch((e) => {
        console.error(e);
        return null;
      });
      const quizId =
        typeof res?.quiz_id === 'string'
          ? res.quiz_id
          : typeof res?.quiz?.quiz_id === 'string'
            ? res.quiz.quiz_id
            : typeof res?.quiz === 'string'
              ? res.quiz
              : typeof res?.id === 'string'
                ? res.id
                : null;
      if (quizId) {
        router.push(`/student/quiz/play?quizId=${quizId}&mode=focus`);
      } else {
        setError(res?.detail || 'フォーカス学習の開始に失敗しました');
      }
    } catch (err) {
      console.error(err);
      setError('フォーカス学習の開始に失敗しました');
    } finally {
      setStartingFocus(false);
      setFocusModal(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-10 space-y-8 px-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">クイズを選ぶ</h1>
          <p className="text-slate-600 text-sm sm:text-base">STEP 2 / 2　レベル選択 → クイズ選択</p>
        </div>
        <Link href="/student/quiz" className="text-indigo-600 font-semibold text-sm sm:text-base">
          ← レベル一覧に戻る
        </Link>
      </div>

      <section className="bg-white shadow rounded-xl border border-slate-100 p-5 flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-indigo-600">{levelLabel}</p>
            <p className="text-lg font-bold text-slate-900">{collection.title}</p>
            <p className="text-sm text-slate-600">{description}</p>
          </div>
          <div className="text-sm text-slate-600 space-y-1 sm:text-right">
            <p>クイズ数: {quizCount}</p>
            <p>問題数: {totalQuestions || representativeQuestions || 0}問</p>
            {timePerQuestion !== null && <p>制限時間: {timePerQuestion}秒 × 問題</p>}
          </div>
        </div>
      </section>

      <div className="space-y-3">
        {quizzes.map(({ quiz, questionCount }) => (
          <Link
            key={quiz.quiz_id}
            href={`/student/quiz/play?quizId=${quiz.quiz_id}`}
            role="button"
            className="bg-white shadow rounded-lg border border-slate-100 p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between hover:shadow-md active:scale-[0.98] transition cursor-pointer"
          >
            <div className="space-y-1">
              <p className="text-base font-semibold text-slate-900">{quiz.title ?? `Quiz #${quiz.sequence_no}`}</p>
              <p className="text-sm text-slate-600">
                番号: #{quiz.sequence_no}　{questionCount}問
                {quiz.timer_seconds ? ` / ${quiz.timer_seconds}秒 × 問題` : ''}
              </p>
            </div>
          </Link>
        ))}
        {quizzes.length === 0 && (
          <div className="bg-white shadow rounded-lg border border-slate-100 px-5 py-8 text-center text-slate-600">
            このレベルにはまだクイズがありません。
          </div>
        )}
      </div>

      <section className="space-y-3">
        <p className="text-sm font-semibold text-slate-700 mt-4">その他の演習モード</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setRandomModal(true)}
            className="bg-indigo-50 text-slate-900 shadow rounded-lg border border-indigo-100 p-4 flex flex-col gap-2 hover:shadow-md active:scale-[0.98] transition text-left cursor-pointer"
          >
            <p className="text-base font-semibold text-slate-900">ランダム演習</p>
            <p className="text-sm text-slate-700">このレベルの100問からランダムに出題します</p>
            <p className="text-xs text-slate-600">対象: {totalQuestions || representativeQuestions || 0}問</p>
          </button>
          <button
            type="button"
            disabled={focusTotal === 0 || focusLoading}
            onClick={() => {
              if (focusTotal === 0) {
                alert('フォーカス学習の対象となる問題がありません。まずは通常モードでクイズに取り組んでください。');
                return;
              }
              setFocusModal(true);
            }}
            className={`shadow rounded-lg border p-4 flex flex-col gap-2 text-left transition active:scale-[0.98] ${
              focusTotal === 0
                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-amber-50 border-amber-100 text-slate-900 hover:shadow-md cursor-pointer'
            }`}
          >
            <p className="text-base font-semibold text-slate-900">フォーカス学習</p>
            <p className="text-sm text-slate-700">このレベルで正答率が低い単語を中心に出題します</p>
            <p className="text-xs text-slate-600">
              {focusLoading ? '対象件数を確認中...' : `対象: ${focusTotal}問`}
            </p>
          </button>
        </div>
      </section>

      {randomModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">ランダム演習を開始</h3>
              <button onClick={() => setRandomModal(false)} className="text-slate-500 hover:text-slate-700 text-sm">
                閉じる
              </button>
            </div>
            <p className="text-sm text-slate-700">
              このレベルの100問から、ランダムに出題します。出題する問題数を選んでください。
            </p>
            <p className="text-xs text-slate-500">対象: {totalQuestions || representativeQuestions || 0}問</p>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y">
              {randomOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setRandomSelection(opt)}
                  className={`w-full px-4 py-3 text-left ${
                    randomSelection === opt ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'bg-white text-slate-800'
                  }`}
                >
                  {opt}問
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRandomModal(false)}
                className="px-4 py-2 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={startRandomSession}
                disabled={startingRandom}
                className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {startingRandom ? '開始中...' : '開始する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {focusModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">フォーカス学習を開始</h3>
              <button onClick={() => setFocusModal(false)} className="text-slate-500 hover:text-slate-700 text-sm">
                閉じる
              </button>
            </div>
            <p className="text-sm text-slate-700">
              このレベルで正答率が低い単語を中心に出題します。出題する問題数を選んでください。
            </p>
            <p className="text-xs text-slate-500">対象: {focusTotal}問</p>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y">
              {focusOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setFocusSelection(opt)}
                  className={`w-full px-4 py-3 text-left ${
                    focusSelection === opt ? 'bg-amber-50 text-amber-700 font-semibold' : 'bg-white text-slate-800'
                  }`}
                >
                  {opt}問
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setFocusModal(false)}
                className="px-4 py-2 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={startFocusSession}
                className="px-4 py-2 text-sm rounded-md bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={focusTotal === 0 || startingFocus}
              >
                {startingFocus ? '開始中...' : '開始する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
