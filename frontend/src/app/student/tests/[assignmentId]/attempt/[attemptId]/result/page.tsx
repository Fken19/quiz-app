'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getStudentAttemptResult } from '@/lib/api/test';
import type { AttemptResultResponse } from '@/types/test';

export default function ResultPage() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.assignmentId as string;
  const attemptId = params.attemptId as string;

  const [result, setResult] = useState<AttemptResultResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        setIsLoading(true);
        const data = await getStudentAttemptResult(attemptId);
        setResult(data);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '結果の取得に失敗しました';
        console.error('Error fetching result:', err);
        setError(errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResult();
  }, [attemptId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700">結果を読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <h1 className="text-2xl font-bold text-red-600 mb-4">エラーが発生しました</h1>
          <p className="text-gray-700 mb-6">{error || '結果を取得できませんでした'}</p>
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

  const scorePercentage = Math.round((result.score / 100) * 100);
  const totalTimeSeconds = Math.floor(result.total_time_ms / 1000);
  const mins = Math.floor(totalTimeSeconds / 60);
  const secs = totalTimeSeconds % 60;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-3xl mx-auto">
        {/* スコア表示 */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              {result.test_title}
            </h1>
            <p className="text-gray-600 mb-6">受験完了</p>

            <div className="flex justify-around items-center mb-8">
              {/* スコア */}
              <div className="text-center">
                <div className={`text-6xl font-bold ${
                  scorePercentage >= 70 ? 'text-green-600' :
                  scorePercentage >= 50 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {Math.round(result.score)}
                </div>
                <p className="text-gray-900 text-sm mt-2 font-semibold">スコア</p>
              </div>

              {/* 正解数 */}
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600">
                  {result.correct_count}/{result.total_questions}
                </div>
                <p className="text-gray-900 text-sm mt-2 font-semibold">正解数</p>
              </div>

              {/* 時間 */}
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {mins}:{secs.toString().padStart(2, '0')}
                </div>
                <p className="text-gray-900 text-sm mt-2 font-semibold">所要時間（全体）</p>
              </div>
            </div>

            {/* メタ情報 */}
            <div className="text-sm text-gray-700 font-medium space-y-1">
              <p>受験日時: {new Date(result.completed_at).toLocaleString('ja-JP')}</p>
              <p>受験回数: {result.attempt_no}回目</p>
            </div>
          </div>
        </div>

        {/* 詳細結果 */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-800">問題別結果</h2>

          {result.details.map((detail, idx) => (
            <div
              key={detail.question_order}
              className={`rounded-lg p-4 border-l-4 ${
                detail.is_correct
                  ? 'bg-green-50 border-green-500'
                  : 'bg-red-50 border-red-500'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900">
                    問題 {detail.question_order}
                  </h3>
                  <p className="text-2xl text-gray-900 font-bold mt-2">
                    {detail.english_word}
                  </p>
                </div>
                <div className={`text-2xl font-bold ${
                  detail.is_correct ? 'text-green-600' : 'text-red-600'
                }`}>
                  {detail.is_correct ? '✓ 正解' : '✗ 不正解'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-900 font-bold mb-1">あなたの答え:</p>
                  <p className={`text-lg font-semibold ${
                    detail.is_correct ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {detail.selected_text_ja || '(未回答)'}
                  </p>
                </div>

                {!detail.is_correct && (
                  <div>
                    <p className="text-gray-900 font-bold mb-1">正解:</p>
                    <p className="text-lg font-semibold text-blue-700">
                      {detail.correct_text_ja}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-gray-900 font-bold mb-1">回答時間:</p>
                  <p className="text-lg font-semibold text-gray-800">
                    {detail.reaction_time_ms
                      ? `${Math.round(detail.reaction_time_ms / 1000)}秒`
                      : '不明'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* アクション */}
        <div className="flex gap-4 mt-8 mb-8">
          <button
            onClick={() => router.push('/student/tests')}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold"
          >
            テスト一覧に戻る
          </button>
          <button
            onClick={() => router.push(`/student/tests/${assignmentId}`)}
            className="flex-1 px-4 py-3 bg-gray-600 text-white rounded hover:bg-gray-700 font-semibold"
          >
            テスト内容を見る
          </button>
        </div>
      </div>
    </div>
  );
}
