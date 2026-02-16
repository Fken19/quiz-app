'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getStudentAssignmentResults } from '@/lib/api/test';
import type { StudentAssignmentResultsResponse } from '@/types/test';

export default function StudentResultSummaryPage() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.assignmentId as string;

  const [result, setResult] = useState<StudentAssignmentResultsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setIsLoading(true);
        const data = await getStudentAssignmentResults(assignmentId);
        setResult(data);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '結果の取得に失敗しました';
        console.error('Error fetching results:', err);
        setError(errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    if (assignmentId) {
      fetchResults();
    }
  }, [assignmentId]);

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

  const passingPercentage = result?.passing_percentage ?? null;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900">受験結果</h1>
            <button
              onClick={() => router.push('/student/tests')}
              className="text-indigo-600 font-semibold"
            >
              ← テスト一覧へ戻る
            </button>
          </div>
          {result?.announcement?.message && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {result.announcement.message}
            </div>
          )}
          {passingPercentage !== null && (
            <div className="mt-3 text-sm font-semibold text-slate-700">
              合格ライン: {passingPercentage}%
            </div>
          )}
        </div>

        {error && (
          <div className="bg-white rounded-lg shadow-md p-6 text-red-600">
            {error}
          </div>
        )}

        {!error && (!result || result.results.length === 0) && (
          <div className="bg-white rounded-lg shadow-md p-6 text-slate-600">
            受験結果がありません。受験後にここに表示されます。
          </div>
        )}

        {!error && result && result.results.length > 0 && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="text-2xl font-bold text-slate-900">{result.test_title}</div>
              <div className="text-sm text-slate-700 font-medium">受験結果一覧</div>
            </div>

            {result.results.map((r) => (
              <div key={r.attempt_id} className="bg-white rounded-lg shadow-md p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-semibold text-slate-900">{r.attempt_no}回目</div>
                    <div className="text-sm text-slate-700 font-medium">
                      受験日時: {r.completed_at ? new Date(r.completed_at).toLocaleString('ja-JP') : '不明'}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-3xl font-bold text-indigo-600">{Math.round(r.score || 0)}</div>
                    <div className="text-sm text-slate-700 font-semibold">スコア</div>
                    {passingPercentage !== null && (
                      <div
                        className={`text-xs font-semibold ${
                          r.total_questions > 0 &&
                          (r.correct_count / r.total_questions) * 100 >= passingPercentage
                            ? 'text-emerald-600'
                            : 'text-rose-600'
                        }`}
                      >
                        {r.total_questions > 0 &&
                        (r.correct_count / r.total_questions) * 100 >= passingPercentage
                          ? '合格'
                          : '不合格'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="bg-slate-50 rounded p-3">
                    <div className="text-slate-700 font-semibold">正解数</div>
                    <div className="text-lg font-semibold text-slate-900">
                      {r.correct_count}/{r.total_questions}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded p-3">
                      <div className="text-slate-700 font-semibold">所要時間（全体）</div>
                      <div className="text-lg font-semibold text-slate-900">
                        {Math.floor(r.total_time_ms / 60000)}:{
                          Math.floor((r.total_time_ms % 60000) / 1000).toString().padStart(2, '0')
                        }
                      </div>
                  </div>
                  <div className="bg-slate-50 rounded p-3">
                    <div className="text-slate-700 font-semibold">詳細</div>
                    <button
                      onClick={() => router.push(`/student/tests/${assignmentId}/attempt/${r.attempt_id}/result`)}
                      className="mt-1 px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                      受験結果を見る
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <div className="bg-white rounded-lg shadow-md p-6">
              <button
                onClick={() => router.push(`/student/tests/${assignmentId}`)}
                className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300"
              >
                テスト内容を見る
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
