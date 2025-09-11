'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { QuizSet, QuizItem, WordTranslation } from '@/types/quiz';

export default function QuizPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const quizId = params.id as string;

  const [quizSet, setQuizSet] = useState<QuizSet | null>(null);
  const [quizItems, setQuizItems] = useState<QuizItem[]>([]);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [responses, setResponses] = useState<Record<string, { translation_id: string; start_time: number }>>({});
  const [startTime, setStartTime] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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
      // TODO: 実際のAPIコールに置き換え
      // const quizSet = await getQuizSet(quizId);
      // const quizItems = await getQuizItems(quizId);
      
      // デモデータ
      const demoQuizSet: QuizSet = {
        id: quizId,
        mode: 'default',
        level: 2,
        segment: 1,
        question_count: 10,
        started_at: new Date().toISOString()
      };

      const demoQuizItems: QuizItem[] = [
        {
          id: 'item1',
          quiz_set_id: quizId,
          word_id: 'word1',
          word: {
            id: 'word1',
            text: 'beautiful',
            pos: 'adjective',
            level: 2,
            tags: ['basic']
          },
          translations: [
            { id: 'trans1', word_id: 'word1', ja: '美しい', is_correct: true },
            { id: 'trans2', word_id: 'word1', ja: '大きい', is_correct: false },
            { id: 'trans3', word_id: 'word1', ja: '小さい', is_correct: false },
            { id: 'trans4', word_id: 'word1', ja: '早い', is_correct: false },
          ],
          order_no: 1
        },
        {
          id: 'item2',
          quiz_set_id: quizId,
          word_id: 'word2',
          word: {
            id: 'word2',
            text: 'knowledge',
            pos: 'noun',
            level: 2,
            tags: ['academic']
          },
          translations: [
            { id: 'trans5', word_id: 'word2', ja: '時間', is_correct: false },
            { id: 'trans6', word_id: 'word2', ja: '知識', is_correct: true },
            { id: 'trans7', word_id: 'word2', ja: '経験', is_correct: false },
            { id: 'trans8', word_id: 'word2', ja: '技術', is_correct: false },
          ],
          order_no: 2
        }
      ];

      setQuizSet(demoQuizSet);
      setQuizItems(demoQuizItems);
    } catch (err) {
      console.error('Failed to fetch quiz data:', err);
      setError('クイズデータの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleStartQuiz = async () => {
    try {
      setQuizStarted(true);
      setStartTime(Date.now());
      // 最初の問題の回答開始時刻を記録
      const currentItem = quizItems[currentItemIndex];
      setResponses(prev => ({
        ...prev,
        [currentItem.id]: { translation_id: '', start_time: Date.now() }
      }));
    } catch (err) {
      console.error('Failed to start quiz:', err);
      setError('クイズの開始に失敗しました');
    }
  };

  const handleAnswerSelect = (translationId: string) => {
    setSelectedAnswer(translationId);
    const currentItem = quizItems[currentItemIndex];
    setResponses(prev => ({
      ...prev,
      [currentItem.id]: {
        ...prev[currentItem.id],
        translation_id: translationId
      }
    }));
  };

  const handleNextQuestion = () => {
    if (currentItemIndex < quizItems.length - 1) {
      setCurrentItemIndex(currentItemIndex + 1);
      const nextItem = quizItems[currentItemIndex + 1];
      
      // 次の問題の回答開始時刻を記録
      if (!responses[nextItem.id]) {
        setResponses(prev => ({
          ...prev,
          [nextItem.id]: { translation_id: '', start_time: Date.now() }
        }));
      }
      
      setSelectedAnswer(responses[nextItem.id]?.translation_id || '');
    }
  };

  const handlePrevQuestion = () => {
    if (currentItemIndex > 0) {
      setCurrentItemIndex(currentItemIndex - 1);
      const prevItem = quizItems[currentItemIndex - 1];
      setSelectedAnswer(responses[prevItem.id]?.translation_id || '');
    }
  };

  const handleSubmitQuiz = async () => {
    setSubmitting(true);
    try {
      // 回答をチェックして採点
      let correctAnswers = 0;
      let totalLatency = 0;
      
      quizItems.forEach(item => {
        const response = responses[item.id];
        if (response?.translation_id) {
          const selectedTranslation = item.translations.find(t => t.id === response.translation_id);
          if (selectedTranslation?.is_correct) {
            correctAnswers++;
          }
          // 反応時間は実際のAPI実装時に正確に計算
          totalLatency += 2000; // デモ用固定値
        }
      });
      
      const score = Math.round((correctAnswers / quizItems.length) * 100);
      setFinalScore(score);
      setQuizCompleted(true);
      
      // TODO: 実際のAPIコールでクイズ結果を保存
      // await submitQuizResults(quizId, responses);
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
          
          <p className="text-lg text-gray-700 mb-6 text-center">
            この英単語の意味として正しいものを選択してください
          </p>

          {/* 選択肢 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {currentItem.translations.map((translation, index) => (
              <button
                key={translation.id}
                onClick={() => handleAnswerSelect(translation.id)}
                className={`p-6 rounded-lg border-2 transition-colors text-left ${
                  selectedAnswer === translation.id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span className="font-bold text-lg text-gray-700 mr-3">
                  {String.fromCharCode(65 + index)}.
                </span>
                <span className="text-lg text-gray-900">{translation.ja}</span>
              </button>
            ))}
          </div>

          {/* ナビゲーションボタン */}
          <div className="flex justify-between">
            <button
              onClick={handlePrevQuestion}
              disabled={currentItemIndex === 0}
              className="px-6 py-3 text-gray-600 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              前の問題
            </button>
            
            {currentItemIndex === quizItems.length - 1 ? (
              <button
                onClick={handleSubmitQuiz}
                disabled={submitting || !selectedAnswer}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium disabled:opacity-50 flex items-center"
              >
                {submitting ? (
                  <>
                    <LoadingSpinner size="small" className="mr-2" />
                    提出中...
                  </>
                ) : (
                  'クイズを提出'
                )}
              </button>
            ) : (
              <button
                onClick={handleNextQuestion}
                disabled={!selectedAnswer}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                次の問題
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
