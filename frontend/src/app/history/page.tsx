'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { QuizResult } from '@/types/quiz';

interface HistoryFilters {
  dateFrom: string;
  dateTo: string;
  level: string;
  sortBy: 'date' | 'score' | 'level';
  sortOrder: 'asc' | 'desc';
}

export default function HistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [results, setResults] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<HistoryFilters>({
    dateFrom: '',
    dateTo: '',
    level: '',
    sortBy: 'date',
    sortOrder: 'desc'
  });

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    fetchHistory();
  }, [session, status, router, filters]); // filtersを依存配列に追加

  // applyFiltersは不要になるため削除
  // useEffect(() => {
  //   applyFilters();
  // }, [results, filters]);

  const fetchHistory = async () => {
    try {
      const token = session?.backendAccessToken;
      if (!token) {
        setError('認証トークンが見つかりません');
        return;
      }

      // クエリパラメータを構築
      const params = new URLSearchParams();
      if (filters.dateFrom) params.append('date_from', filters.dateFrom);
      if (filters.dateTo) params.append('date_to', filters.dateTo);
      if (filters.level) params.append('level', filters.level);
      params.append('sort_by', filters.sortBy);
      params.append('sort_order', filters.sortOrder);

      // 実際のAPIコール
      const response = await fetch(`/api/history?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const historyData = await response.json();
      setResults(historyData);
    } catch (err) {
      console.error('Failed to fetch history:', err);
      setError('履歴データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: keyof HistoryFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}分${seconds}秒`;
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

  const averageScore = results.length > 0 ? 
    results.reduce((sum: number, result: QuizResult) => sum + (result.total_score / result.total_questions), 0) / results.length * 100 : 0;

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">マイ履歴</h1>
        <p className="mt-2 text-gray-600">
          これまでのクイズ受験履歴を確認できます。
        </p>
      </div>

      {/* 統計サマリー */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <span className="text-xl">📊</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">総受験回数</p>
              <p className="text-2xl font-bold text-gray-900">{results.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <span className="text-xl">⭐</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">平均スコア</p>
              <p className="text-2xl font-bold text-gray-900">{averageScore.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <span className="text-xl">🎯</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">最高スコア</p>
              <p className="text-2xl font-bold text-gray-900">
                {results.length > 0 ? 
                  Math.max(...results.map((r: QuizResult) => Math.round((r.total_score / r.total_questions) * 100))) + '%' : 
                  '0%'
                }
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <span className="text-xl">📈</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">総問題数</p>
              <p className="text-2xl font-bold text-gray-900">
                {results.reduce((sum: number, result: QuizResult) => sum + result.total_questions, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* フィルター */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">フィルター・並び替え</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              開始日
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              終了日
            </label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              レベル
            </label>
            <select
              value={filters.level}
              onChange={(e) => handleFilterChange('level', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">全レベル</option>
              <option value="1">レベル1</option>
              <option value="2">レベル2</option>
              <option value="3">レベル3</option>
              <option value="4">レベル4</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              並び替え
            </label>
            <select
              value={filters.sortBy}
              onChange={(e) => handleFilterChange('sortBy', e.target.value as 'date' | 'score' | 'level')}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="date">受験日時</option>
              <option value="score">スコア</option>
              <option value="level">レベル</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              順序
            </label>
            <select
              value={filters.sortOrder}
              onChange={(e) => handleFilterChange('sortOrder', e.target.value as 'asc' | 'desc')}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="desc">降順</option>
              <option value="asc">昇順</option>
            </select>
          </div>
        </div>
      </div>

      {/* 履歴一覧 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            受験履歴 ({results.length}件)
          </h3>
        </div>
        
        {results.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-4xl mb-4 block">📊</span>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              履歴がありません
            </h3>
            <p className="text-gray-600 mb-4">
              フィルター条件に一致する受験履歴がありません。
            </p>
            <Link
              href="/quiz/start"
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              クイズに挑戦する
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {results.map((result: QuizResult) => {
              const scorePercentage = Math.round((result.total_score / result.total_questions) * 100);
              return (
                <div key={result.quiz_set.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                          scorePercentage >= 70 ? 'bg-green-500' : 
                          scorePercentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}>
                          {scorePercentage}%
                        </div>
                        <div>
                          <h4 className="text-lg font-medium text-gray-900">
                            レベル{result.quiz_set.level} セグメント{result.quiz_set.segment}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {formatDate(result.quiz_set.started_at!)} • 
                            {result.total_questions}問 • 
                            {formatDuration(result.total_duration_ms)} • 
                            {result.quiz_set.mode === 'default' ? '順番通り' : 'ランダム'}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-sm text-gray-600">
                          {result.total_score}/{result.total_questions} 正解
                        </p>
                        <p className="text-sm text-gray-600">
                          平均 {(result.average_latency_ms / 1000).toFixed(1)}秒
                        </p>
                      </div>
                      <Link
                        href={`/quiz/${result.quiz_set.id}/result`}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
                      >
                        詳細
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
