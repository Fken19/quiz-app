"use client";

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { quizAPI } from '@/services/api';
import { useState } from 'react';

export default function QuizLevelPage() {
  const { data: session, status, update } = useSession();
  console.log('session:', session, 'status:', status);
  const router = useRouter();
  const params = useParams();
  const level = parseInt(params.level as string);
  const [loading, setLoading] = useState(false);

  // 10問単位のセクション
  const segments = Array.from({ length: 10 }, (_, i) => ({
    value: i + 1,
    label: `セクション${i + 1}`,
    description: `${i * 10 + 1}〜${(i + 1) * 10}番の単語`
  }));

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!session) {
    router.push('/auth/signin');
    return null;
  }

  const handleSegmentSelect = async (segment: number) => {
    setLoading(true);
    try {
      let token = session?.backendAccessToken;
      console.log('handleSegmentSelect token (before refresh):', token);

      // フロント側セッションにトークンがない場合は update() で再取得を試みる
      if (!token && typeof update === 'function') {
        try {
          const refreshed = await update();
          token = (refreshed as any)?.backendAccessToken;
          console.log('handleSegmentSelect token (after refresh):', token);
        } catch (e) {
          console.warn('session.update() failed', e);
        }
      }

      if (!token) throw new Error('No backendAccessToken');
      const quizSet = await quizAPI.createQuizSet({
        level,
        segment,
        mode: 'default',
        question_count: 10
      }, token);
      console.log('quizSet response:', quizSet);
      router.push(`/quiz/${quizSet.id}`);
    } catch (error) {
      setLoading(false);
      console.error('クイズ作成エラー:', error);
      alert('クイズの作成に失敗しました\n' + (error instanceof Error ? error.message : ''));
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">セクション選択</h1>
        <p className="mt-2 text-gray-600">レベル{level}の10問単位のセクションを選んでください。</p>
      </div>
      <div className="grid grid-cols-1 gap-6">
        {segments.map((segment) => (
          <button
            key={segment.value}
            onClick={() => handleSegmentSelect(segment.value)}
            disabled={loading}
            className="w-full flex items-center p-6 border-2 rounded-lg cursor-pointer transition-colors border-gray-200 hover:border-indigo-500 hover:bg-indigo-50 disabled:opacity-50"
          >
            <div className="ml-3 text-left">
              <p className="text-lg font-medium text-gray-900">{segment.label}</p>
              <p className="text-sm text-gray-600">{segment.description}</p>
            </div>
          </button>
        ))}
      </div>
      <div className="mt-8 text-center">
        <Link href="/quiz/start" className="text-indigo-600 hover:underline">レベル選択に戻る</Link>
      </div>
    </div>
  );
}
