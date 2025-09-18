'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { QuizResult } from '@/types/quiz';

export default function QuizResultPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const quizId = params.id as string;

  const [result, setResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 確認必須フローは不要になったため削除

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    fetchQuizResult();
  }, [session, status, router, quizId]);

  const fetchQuizResult = async () => {
    try {
      const { quizAPI } = await import('@/services/api');
      const result = await quizAPI.getQuizResultFromBackend(quizId);
      console.log('Fetched quiz result:', result);
      setResult(result);
    } catch (err) {
      console.error('Failed to fetch quiz result:', err);
      setError('結果データの取得に失敗しました');
    } finally {
      setLoading(false);
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
          <Link
            href="/dashboard"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md"
          >
            ダッシュボードに戻る
          </Link>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            結果が見つかりません
          </h2>
          <Link
            href="/dashboard"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md"
          >
            ダッシュボードに戻る
          </Link>
        </div>
      </div>
    );
  }

  // --- 計算系（タイムアウトは 10s で扱う） ---
  const TIMEOUT_MS = 10000;
  const responsesByItem: Record<string, typeof result.quiz_responses[number] | undefined> = Object.fromEntries(
    result.quiz_responses.map(r => [String(r.quiz_item_id), r])
  );
  const isTimeout = (r: any | undefined) => {
    if (!r) return false;
    const lat = Number((r as any).latency_ms);
    const chosenText = (r as any).chosen_translation_text;
    // Timeout の定義: 不正解 かつ (10秒超過 or Unknown)
    if (r.is_correct === true) return false;
    if ((Number.isFinite(lat) && lat >= TIMEOUT_MS)) return true;
    if (!chosenText || chosenText === 'Unknown') return true;
    return false;
  };
  const perItemLatencyMs = result.quiz_items.map(item => {
    const r = responsesByItem[String(item.id)];
    if (!r) return TIMEOUT_MS; // 念のため
    return isTimeout(r) ? TIMEOUT_MS : (r.latency_ms ?? TIMEOUT_MS);
  });
  const computedTotalMs = perItemLatencyMs.reduce((a, b) => a + (Number.isFinite(b) ? Number(b) : 0), 0);
  const computedAvgMs = perItemLatencyMs.length ? Math.round(computedTotalMs / perItemLatencyMs.length) : result.average_latency_ms;

  const scorePercentage = Math.round((result.total_score / result.total_questions) * 100);
  const durationMinutes = Math.floor(computedTotalMs / 60000);
  const durationSeconds = Math.floor((computedTotalMs % 60000) / 1000);
  const averageLatencySeconds = (computedAvgMs / 1000).toFixed(1);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ヘッダー */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">クイズ結果</h1>
        <p className="mt-2 text-gray-600">
          レベル{result.quiz_set.level} セグメント{result.quiz_set.segment}
        </p>
      </div>

      {/* スコア概要 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center">
          <div className="text-6xl mb-4">
            {scorePercentage >= 70 ? '🎉' : scorePercentage >= 50 ? '😊' : '😔'}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            あなたのスコア
          </h2>
          <p className={`text-5xl font-bold mb-4 ${
            scorePercentage >= 70 ? 'text-green-600' : 
            scorePercentage >= 50 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {scorePercentage}%
          </p>
          <p className="text-lg text-gray-600">
            {result.total_questions}問中 {result.total_score}問正解
          </p>
        </div>
      </div>

      {/* 統計情報 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <span className="text-2xl">⏱️</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">所要時間</p>
              <p className="text-xl font-bold text-gray-900">
                {durationMinutes}分{durationSeconds}秒
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <span className="text-2xl">⚡</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">平均反応時間</p>
              <p className="text-xl font-bold text-gray-900">
                {averageLatencySeconds}秒
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <span className="text-2xl">📈</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">出題モード</p>
              <p className="text-xl font-bold text-gray-900">
                {result.quiz_set.mode === 'default' ? '順番通り' : 'ランダム'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 問題別詳細 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">問題別詳細</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {result.quiz_items.map((item, index) => {
            const response = result.quiz_responses.find(r => r.quiz_item_id === item.id);
            // まず ID で一致、無ければテキストでフォールバック一致
            const chosenTranslation = response ? (
              item.translations.find(t => t.id === (response as any).chosen_translation_id) ||
              item.translations.find(t => t.ja === (response as any).chosen_translation_text)
            ) : null;
            const correctTranslation = item.translations.find(t => t.is_correct);
            const wasTimeout = isTimeout(response as any);
            const showLatencyMs = response ? (wasTimeout ? TIMEOUT_MS : (response.latency_ms ?? TIMEOUT_MS)) : TIMEOUT_MS;

            // 追加情報（説明・例文）があれば表示（存在する場合のみ）
            const w: any = item.word as any;
            const description: string | undefined = w?.description || w?.desc || w?.definition;
            const exampleEn: string | undefined = w?.example_en || w?.example || w?.example_sentence_en || w?.sentence_en;
            const exampleJa: string | undefined = w?.example_ja || w?.example_jp || w?.example_sentence_ja || w?.sentence_ja;
            
            return (
              <div key={item.id} className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                      response?.is_correct ? 'bg-green-500' : 'bg-red-500'
                    }`}>
                      {index + 1}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-bold text-gray-900 mb-2">
                      {item.word.text}
                      <span className="ml-2 text-sm text-gray-500">({item.word.pos})</span>
                    </h4>
                    
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm font-medium text-gray-600">正解: </span>
                        <span className="text-green-600 font-medium">
                          {correctTranslation?.ja}
                        </span>
                      </div>
                      
                      {/* あなたの回答（未回答=時間切れも明示） */}
                      <div>
                        <span className="text-sm font-medium text-gray-600">あなたの回答: </span>
                        {chosenTranslation ? (
                          <span className={`font-medium ${response?.is_correct ? 'text-green-600' : 'text-red-600'}`}>
                            {chosenTranslation.ja}
                          </span>
                        ) : (
                          (() => {
                            const chosenText = (response as any)?.chosen_translation_text;
                            if (!chosenText || chosenText === 'Unknown' || wasTimeout) {
                              return <span className="font-medium text-orange-600">未回答（時間切れ）</span>;
                            }
                            return (
                              <span className={`font-medium ${response?.is_correct ? 'text-green-600' : 'text-red-600'}`}>
                                {chosenText}
                              </span>
                            );
                          })()
                        )}
                      </div>
                      
                      <div>
                        <span className="text-sm font-medium text-gray-600">反応時間: </span>
                        <span className="text-gray-900">
                          {(showLatencyMs / 1000).toFixed(1)}秒
                        </span>
                      </div>

                      {/* 単語の補足情報（あれば） */}
                      {description && (
                        <div>
                          <span className="text-sm font-medium text-gray-600">説明: </span>
                          <span className="text-gray-900">{description}</span>
                        </div>
                      )}
                      {(exampleEn || exampleJa) && (
                        <div className="text-sm text-gray-700">
                          <div className="text-gray-600 font-medium">例文:</div>
                          {exampleEn && <div className="text-gray-900">{exampleEn}</div>}
                          {exampleJa && <div className="text-gray-500">{exampleJa}</div>}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex-shrink-0">
                    {response?.is_correct ? (
                      <span className="text-green-500 text-2xl">✅</span>
                    ) : (
                      <span className="text-red-500 text-2xl">❌</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

          {/* アクションボタン */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/quiz/start"
              className="flex-1 text-center py-3 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              別のクイズに挑戦
            </Link>
            <Link
              href="/quiz/start?focus=weak"
              className="flex-1 text-center py-3 px-4 bg-pink-100 text-pink-700 rounded-md hover:bg-pink-200 transition-colors"
            >
              苦手だけ10問
            </Link>
            <Link
              href="/quiz/start?focus=unseen"
              className="flex-1 text-center py-3 px-4 bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200 transition-colors"
            >
              未学習だけ10問
            </Link>
            <Link
              href="/history"
              className="flex-1 text-center py-3 px-4 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
            >
              マイ履歴を見る
            </Link>
            <Link
              href="/dashboard"
              className="flex-1 text-center py-3 px-4 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
            >
              ダッシュボードに戻る
            </Link>
          </div>
    </div>
  );
}
