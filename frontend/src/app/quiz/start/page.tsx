'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';

interface QuizStartForm {
  level: number;
  segment: number;
  mode: 'default' | 'random';
  question_count: number;
}

export default function QuizStart() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [form, setForm] = useState<QuizStartForm>({
    level: 1,
    segment: 1,
    mode: 'default',
    question_count: 10
  });
  const [loading, setLoading] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // TODO: APIコールでクイズセットを作成
      // const quizSet = await createQuizSet(form);
      
      // デモ用：ランダムIDでクイズ画面に遷移
      const demoQuizId = 'demo-' + Date.now();
      router.push(`/quiz/${demoQuizId}`);
    } catch (error) {
      console.error('Failed to create quiz set:', error);
      setLoading(false);
    }
  };

  const levels = [
    { value: 1, label: '初級（レベル1）', description: '基本的な英単語' },
    { value: 2, label: '中級（レベル2）', description: '日常会話レベル' },
    { value: 3, label: '上級（レベル3）', description: '高校・大学レベル' },
    { value: 4, label: '最上級（レベル4）', description: 'TOEIC・英検レベル' },
  ];

  const segments = [
    { value: 1, label: 'セグメント1', description: '基本語彙' },
    { value: 2, label: 'セグメント2', description: '応用語彙' },
    { value: 3, label: 'セグメント3', description: '専門語彙' },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ヘッダー */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">クイズ開始</h1>
        <p className="mt-2 text-gray-600">
          レベルとセグメントを選択して、英単語クイズに挑戦しましょう！
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* レベル選択 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            レベルを選択
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {levels.map((level) => (
              <label
                key={level.value}
                className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  form.level === level.value
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="level"
                  value={level.value}
                  checked={form.level === level.value}
                  onChange={(e) => setForm({ ...form, level: parseInt(e.target.value) })}
                  className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                />
                <div className="ml-3">
                  <p className="text-lg font-medium text-gray-900">
                    {level.label}
                  </p>
                  <p className="text-sm text-gray-600">
                    {level.description}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* セグメント選択 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            セグメントを選択
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {segments.map((segment) => (
              <label
                key={segment.value}
                className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  form.segment === segment.value
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="segment"
                  value={segment.value}
                  checked={form.segment === segment.value}
                  onChange={(e) => setForm({ ...form, segment: parseInt(e.target.value) })}
                  className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                />
                <div className="ml-3">
                  <p className="text-lg font-medium text-gray-900">
                    {segment.label}
                  </p>
                  <p className="text-sm text-gray-600">
                    {segment.description}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* 出題モード選択 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            出題モード
          </h2>
          <div className="grid grid-cols-1 gap-4">
            <label className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
              form.mode === 'default'
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input
                type="radio"
                name="mode"
                value="default"
                checked={form.mode === 'default'}
                onChange={(e) => setForm({ ...form, mode: e.target.value as 'default' | 'random' })}
                className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
              />
              <div className="ml-3">
                <p className="text-lg font-medium text-gray-900">
                  順番通り出題
                </p>
                <p className="text-sm text-gray-600">
                  教材の順番に従って出題されます
                </p>
              </div>
            </label>

            <label className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
              form.mode === 'random'
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input
                type="radio"
                name="mode"
                value="random"
                checked={form.mode === 'random'}
                onChange={(e) => setForm({ ...form, mode: e.target.value as 'default' | 'random' })}
                className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
              />
              <div className="ml-3">
                <p className="text-lg font-medium text-gray-900">
                  ランダム出題
                </p>
                <p className="text-sm text-gray-600">
                  選択したレベル・セグメントからランダムに出題
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* 問題数選択 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            問題数
          </h2>
          <select
            value={form.question_count}
            onChange={(e) => setForm({ ...form, question_count: parseInt(e.target.value) })}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value={5}>5問</option>
            <option value={10}>10問</option>
            <option value={20}>20問</option>
            <option value={50}>50問</option>
          </select>
        </div>

        {/* アクションボタン */}
        <div className="flex space-x-4">
          <Link
            href="/dashboard"
            className="flex-1 py-3 px-4 border border-gray-300 rounded-md text-center text-gray-700 hover:bg-gray-50 transition-colors"
          >
            戻る
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {loading ? (
              <>
                <LoadingSpinner size="small" className="mr-2" />
                準備中...
              </>
            ) : (
              'クイズを開始'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
