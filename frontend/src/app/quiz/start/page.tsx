'use client';


import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function QuizStart() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // レベルは1レベル=約100問想定
  const levels = [
    { value: 1, label: 'レベル1', description: '最初の100語' },
    { value: 2, label: 'レベル2', description: '101〜200語' },
    { value: 3, label: 'レベル3', description: '201〜300語' },
    { value: 4, label: 'レベル4', description: '301〜400語' },
    { value: 5, label: 'レベル5', description: '401〜500語' },
  ];

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

  const handleLevelSelect = (level: number) => {
    router.push(`/quiz/start/level/${level}`);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">レベル選択</h1>
        <p className="mt-2 text-gray-600">
          学習したいレベル（約100問ごと）を選んでください。
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6">
        {levels.map((level) => (
          <button
            key={level.value}
            onClick={() => handleLevelSelect(level.value)}
            className="w-full flex items-center p-6 border-2 rounded-lg cursor-pointer transition-colors border-gray-200 hover:border-indigo-500 hover:bg-indigo-50"
          >
            <div className="ml-3 text-left">
              <p className="text-lg font-medium text-gray-900">{level.label}</p>
              <p className="text-sm text-gray-600">{level.description}</p>
            </div>
          </button>
        ))}
      </div>
      <div className="mt-8 text-center">
        <Link href="/dashboard" className="text-indigo-600 hover:underline">ダッシュボードに戻る</Link>
      </div>
    </div>
  );

}
