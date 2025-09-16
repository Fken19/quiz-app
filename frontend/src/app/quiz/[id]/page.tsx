'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { QuizSet, QuizItem, WordTranslation } from '@/types/quiz';
import { apiGet, apiPost, ApiError } from '@/lib/api-utils';

export default function QuizPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const quizId = params.id as string;

  const [quizSet, setQuizSet] = useState<QuizSet | null>(null);
  const [quizItems, setQuizItems] = useState<QuizItem[]>([]);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [responses, setResponses] = useState<Record<string, { translation_id: string; start_time: number; outcome?: 'correct' | 'wrong' | 'timeout' }>>({});
  const [startTime, setStartTime] = useState<number>(0);
  const [shuffledChoices, setShuffledChoices] = useState<WordTranslation[]>([]);
  const [timer, setTimer] = useState(10);
  const [showJudge, setShowJudge] = useState(false);
  const [judgeResult, setJudgeResult] = useState<'correct' | 'wrong' | 'timeout' | null>(null);
  const [judgeText, setJudgeText] = useState('');
  const [judgeIcon, setJudgeIcon] = useState('');
  const [judgeDisabled, setJudgeDisabled] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answerSubmitting, setAnswerSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    fetchQuizData();
  }, [session, status, router, quizId]);

  const fetchQuizData = async () => {
    try {
      // 既存API: GET /api/quiz-sets/:id/
      const body = await apiGet(`/quiz-sets/${quizId}/`);

  // API から quiz_set / quiz_items を期待
      if (body && (body.quiz_set || body.id || body.quiz_items)) {
        // 一部バックエンドではトップレベルに quiz_set を入れずに返す場合があるためハンドリング
        const qs = body.quiz_set ? body.quiz_set : body;
        // quiz_items は body.quiz_items または qs.quiz_items に入る可能性がある
        const rawItems = (body.quiz_items ?? (qs && (qs as any).quiz_items) ?? []) as QuizItem[];

        // 正規化: フロントは quizItem.translations を期待しているが、バックエンドは
    // quizItem.word.translations に格納する設計のため、ここで translations を保証する
        const normalizedItems = rawItems.map((item: any) => ({
          ...item,
          translations: (item.translations ?? item.word?.translations ?? []).map((t: any) => ({
            id: t.id,
            word_id: t.word_id ?? item.word?.id ?? t.word?.id,
    ja: t.text ?? t.ja ?? '',
    // 公開APIでは is_correct は返さないため false を既定に（判定はサーバ応答で行う）
    is_correct: t.is_correct ?? false
          }))
        })) as QuizItem[];

        setQuizSet(qs as QuizSet);
        setQuizItems(normalizedItems);
        return;
      }
  throw new Error('クイズデータの形式が不正です');
    } catch (err) {
      console.error('Failed to fetch quiz data:', err);
      setError('クイズデータの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 選択肢をランダム化
  const shuffleChoices = (choices: WordTranslation[]) => {
    const arr = [...choices];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // クイズ開始
  const handleStartQuiz = async () => {
    try {
      setQuizStarted(true);
      setStartTime(Date.now());
      setTimer(10);
      setShowJudge(false);
      setJudgeResult(null);
      setJudgeDisabled(false);
      // 最初の問題の選択肢をランダム化
      const currentItem = quizItems[0];
      setShuffledChoices(shuffleChoices(currentItem.translations));
      setResponses(prev => ({
        ...prev,
        [currentItem.id]: { translation_id: '', start_time: Date.now() }
      }));
    } catch (err) {
      console.error('Failed to start quiz:', err);
      setError('クイズの開始に失敗しました');
    }
  };

  // タイマー管理
  useEffect(() => {
    if (!quizStarted || showJudge || answerSubmitting) return;
    if (timer === 0) {
      handleJudge('timeout');
      return;
    }
    timerRef.current = setTimeout(() => setTimer((t) => t - 1), 1000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timer, quizStarted, showJudge, answerSubmitting]);

  // 選択肢選択時
  const handleAnswerSelect = async (translationId: string) => {
    if (showJudge || judgeDisabled || answerSubmitting) return;
    setSelectedAnswer(translationId);
    // 多重タップ防止＆タイマー一時停止
    setJudgeDisabled(true);
    setAnswerSubmitting(true);
    if (timerRef.current) clearTimeout(timerRef.current);

    try {
      // 計測開始: ブラウザ側での合計往復時間を測る
      const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      // サーバーに回答を送信して正誤判定を取得
      const item = quizItems[currentItemIndex];
      const response = await apiPost(`/quiz-sets/${quizId}/submit_answer/`, {
        quiz_item_id: Number(item.id),
        selected_translation_id: Number(translationId),
        reaction_time_ms: (Date.now() - (responses[item.id]?.start_time || Date.now())) || 0
      });
      const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      try {
        // 出力は開発コンソールで見る
        // eslint-disable-next-line no-console
        console.log('[timing] submit_answer', Math.round(t1 - t0), 'ms', { quiz_item_id: item.id, selected_translation_id: translationId, server_payload: response });
      } catch (_) {}
      // APIユーティリティはエラー時に例外を投げるため、ここに来たら成功
      handleJudge(response?.is_correct ? 'correct' : 'wrong', translationId);
    } catch (error) {
      const tErr = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      try {
        // eslint-disable-next-line no-console
        console.log('[timing] submit_answer failed', Math.round(tErr - (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now())), 'ms', { quiz_item_id: quizItems[currentItemIndex]?.id, selected_translation_id: translationId, error });
      } catch (_) {}
      console.error('Failed to submit answer to server:', error);
      // 既に同一問題に回答済み（サーバ側 400）を優しく処理
      if (error instanceof ApiError && error.status === 400) {
        const msg: string = (error.body?.message || error.message || '') as string;
        if (msg.includes('既に回答済み')) {
          // 何もしないで次へ進める（ユーザー体験を壊さない）
          handleJudge('wrong', translationId); // neutral扱い：サーバは保存済みなので画面上は次へ
          return;
        }
      }
      // その他のエラー: クライアント側判定にフォールバック
      handleJudge(
        shuffledChoices.find((t) => t.id === translationId)?.is_correct ? 'correct' : 'wrong',
        translationId
      );
    } finally {
      setAnswerSubmitting(false);
    }
  };

  // 判定処理
  const handleJudge = (result: 'correct' | 'wrong' | 'timeout', translationId?: string) => {
    setShowJudge(true);
    setJudgeResult(result);
    setJudgeDisabled(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    let text = '';
    let icon = '';
    if (result === 'correct') {
      text = '正解！';
      icon = '◯';
    } else if (result === 'wrong') {
      text = '不正解';
      icon = '×';
    } else {
      text = '時間切れ';
      icon = '⏱️';
    }
    setJudgeText(text);
    setJudgeIcon(icon);
    // 回答記録
    const currentItem = quizItems[currentItemIndex];
    setResponses((prev) => ({
      ...prev,
      [currentItem.id]: {
        ...prev[currentItem.id],
        translation_id: translationId || '',
        outcome: result
      }
    }));
  };

  // 次の問題へ（判定画面でどこでもタップ）
  const handleNextQuestion = () => {
    if (!showJudge) return;
    setJudgeDisabled(true);
    setShowJudge(false);
    setJudgeResult(null);
    setJudgeText('');
    setJudgeIcon('');
    setSelectedAnswer('');
    if (currentItemIndex < quizItems.length - 1) {
      const nextIndex = currentItemIndex + 1;
      setCurrentItemIndex(nextIndex);
      setTimer(10);
      setJudgeDisabled(false);
      // 次の問題の選択肢をランダム化
      setShuffledChoices(shuffleChoices(quizItems[nextIndex].translations));
      setResponses((prev) => ({
        ...prev,
        [quizItems[nextIndex].id]: { translation_id: '', start_time: Date.now() }
      }));
    } else {
      // 最後の問題ならクイズ提出
      handleSubmitQuiz();
    }
  };

  // 前の問題ボタンは要件上不要なので削除

  const handleSubmitQuiz = async () => {
    setSubmitting(true);
    try {
      // サーバ保存済みの回答から結果APIで集計を取得
      try {
        const result = await apiGet(`/quiz/result/${quizId}/`);
        const correct = Number(result?.total_score ?? 0);
        const total = Number(result?.total_questions ?? quizItems.length);
        const score = total > 0 ? Math.round((correct / total) * 100) : 0;
        setFinalScore(score);
      } catch (e) {
        // フォールバック: クライアント集計
        let correctAnswers = 0;
        quizItems.forEach(item => {
          const r = responses[item.id];
          if (r?.outcome === 'correct') correctAnswers++;
        });
        const score = Math.round((correctAnswers / quizItems.length) * 100);
        setFinalScore(score);
      }
      setQuizCompleted(true);
    } catch (err) {
      console.error('Failed to submit quiz:', err);
      setError('クイズの提出に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">エラー</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/quiz/start')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md"
          >
            クイズ選択に戻る
          </button>
        </div>
      </div>
    );
  }

  if (!quizSet || quizItems.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            クイズが見つかりません
          </h2>
          <button
            onClick={() => router.push('/quiz/start')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md"
          >
            クイズ選択に戻る
          </button>
        </div>
      </div>
    );
  }

  if (quizCompleted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="text-6xl mb-4">
              {finalScore !== null && finalScore >= 70 ? '🎉' : '😔'}
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              クイズ完了！
            </h2>
            <div className="mb-6">
              <p className="text-lg text-gray-600 mb-2">あなたのスコア</p>
              <p className={`text-4xl font-bold ${
                finalScore !== null && finalScore >= 70 ? 'text-green-600' : 'text-red-600'
              }`}>
                {finalScore}%
              </p>
              <p className="text-sm text-gray-500 mt-2">
                {quizItems.length}問中 {finalScore !== null ? Math.round((finalScore / 100) * quizItems.length) : 0}問正解
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => router.push(`/quiz/${quizId}/result`)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-md font-medium"
              >
                結果詳細を見る
              </button>
              <button
                onClick={() => router.push('/quiz/start')}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-md font-medium"
              >
                別のクイズに挑戦
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 py-2 px-4 rounded-md font-medium"
              >
                ダッシュボードに戻る
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!quizStarted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              英単語クイズ
            </h2>
            <p className="text-gray-600 mb-6">
              レベル{quizSet.level} セグメント{quizSet.segment}
            </p>
            <div className="space-y-3 mb-6 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>問題数:</span>
                <span>{quizSet.question_count} 問</span>
              </div>
              <div className="flex justify-between">
                <span>出題モード:</span>
                <span>{quizSet.mode === 'default' ? '順番通り' : 'ランダム'}</span>
              </div>
            </div>
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                英単語を見て、正しい日本語訳を選択してください。<br/>
                各問題の反応時間も記録されます。
              </p>
            </div>
            <button
              onClick={handleStartQuiz}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-md font-medium text-lg"
            >
              クイズを開始
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentItem = quizItems[currentItemIndex];
  const progress = ((currentItemIndex + 1) / quizItems.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-semibold text-gray-900">
              英単語クイズ - レベル{quizSet.level}
            </h1>
            <div className="text-sm text-gray-600">
              問題 {currentItemIndex + 1} / {quizItems.length}
            </div>
          </div>
          {/* プログレスバー */}
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* 問題表示 */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* 英単語表示 */}
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold text-gray-900 mb-2">
              {currentItem.word.text}
            </h2>
            <p className="text-sm text-gray-500">
              {currentItem.word.pos}
            </p>
          </div>

          {/* タイマー */}
          <div className="flex justify-center mb-6">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <span className="text-indigo-600">残り</span>
              <span className="text-2xl text-indigo-700">{timer}</span>
              <span className="text-indigo-600">秒</span>
            </div>
          </div>

          <p className="text-lg text-gray-700 mb-6 text-center">
            この英単語の意味として正しいものを選択してください
          </p>

          {answerSubmitting && (
            <div className="flex justify-center mb-4" aria-live="polite">
              <span className="text-sm text-gray-500">判定中…</span>
            </div>
          )}

          {/* 選択肢（縦4つ・スクロール禁止） */}
          <div className="flex flex-col gap-4 mb-8">
            {shuffledChoices.map((translation, index) => (
              <button
                key={translation.id}
                onClick={() => handleAnswerSelect(translation.id)}
                disabled={showJudge || judgeDisabled || answerSubmitting}
                className={`p-6 rounded-lg border-2 transition-colors text-left w-full text-lg font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400
                  ${selectedAnswer === translation.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
                  ${(showJudge || judgeDisabled || answerSubmitting) ? 'opacity-60 pointer-events-none' : ''}`}
                style={{ minHeight: '56px' }}
              >
                <span className="font-bold text-lg text-gray-700 mr-3">
                  {String.fromCharCode(65 + index)}.
                </span>
                <span className="text-lg text-gray-900">{translation.ja}</span>
              </button>
            ))}
          </div>

          {/* 判定画面（◯/×/Timeout） */}
          {showJudge && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30"
              onClick={handleNextQuestion}
              style={{ cursor: 'pointer' }}
            >
              <div className="bg-white rounded-lg shadow-lg p-10 flex flex-col items-center">
                <div className="text-6xl mb-4">
                  {judgeIcon}
                </div>
                <div className="text-2xl font-bold mb-2">
                  {judgeText}
                </div>
                <div className="text-gray-600 text-lg">画面のどこでもタップして次へ</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
