'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { startAttempt } from '@/lib/api/test';

/**
 * 受験開始リダイレクトページ
 * assignment_id を受け取って、
 * startAttempt API を呼び出し、
 * 受験画面（attempt_id）にリダイレクト
 */
export default function AttemptStartRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.assignmentId as string;
  const hasStarted = useRef(false);  // 二重開始防止
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 既に開始済みなら何もしない（strict modeの二重実行対策）
    if (hasStarted.current) return;
    hasStarted.current = true;

    const startTest = async () => {
      try {
        const response = await startAttempt(assignmentId);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(
            `attempt_start:${response.attempt_id}`,
            JSON.stringify(response)
          );
        }
        // 受験画面にリダイレクト
        router.push(
          `/student/tests/${assignmentId}/attempt/${response.attempt_id}`
        );
      } catch (err) {
        console.error('Error starting attempt:', err);
        const errorMsg = err instanceof Error ? err.message : '受験開始に失敗しました';
        setError(errorMsg);
        // 3秒後に詳細ページに戻す
        setTimeout(() => {
          router.push(`/student/tests/${assignmentId}`);
        }, 3000);
      }
    };

    startTest();
  }, [assignmentId, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <h2 className="text-xl font-bold text-red-600 mb-4">エラーが発生しました</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <p className="text-sm text-gray-500">3秒後に詳細ページに戻ります...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-700">受験を開始中...</p>
      </div>
    </div>
  );
}
