'use client';

import { useEffect } from 'react';
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

  useEffect(() => {
    const startTest = async () => {
      try {
        const response = await startAttempt(assignmentId);
        // 受験画面にリダイレクト
        router.push(
          `/student/tests/${assignmentId}/attempt/${response.attempt_id}`
        );
      } catch (err) {
        console.error('Error starting attempt:', err);
        // エラーの場合は詳細ページに戻す
        router.push(`/student/tests/${assignmentId}`);
      }
    };

    startTest();
  }, [assignmentId, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-700">受験を開始中...</p>
      </div>
    </div>
  );
}
