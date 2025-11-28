'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api-utils';
import type { PaginatedResponse, StudentVocabListItem } from '@/types/quiz';

type LearningStatus = 'unlearned' | 'weak' | 'learning' | 'mastered';

const STATUS_LABELS: Record<LearningStatus | 'all', string> = {
  all: 'すべて',
  unlearned: '未学習',
  weak: '苦手',
  learning: '学習中',
  mastered: '完璧',
};

const STATUS_COLORS: Record<LearningStatus, string> = {
  unlearned: 'bg-gray-100 text-gray-700',
  weak: 'bg-red-100 text-red-700',
  learning: 'bg-yellow-100 text-yellow-700',
  mastered: 'bg-green-100 text-green-700',
};

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

export default function VocabularyPage() {
  const router = useRouter();
  const [data, setData] = useState<PaginatedResponse<StudentVocabListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // フィルタ状態
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<LearningStatus | 'all'>('all');
  const [headFilter, setHeadFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  // デバウンス用
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          page: page.toString(),
          page_size: pageSize.toString(),
        });

        if (debouncedSearch) {
          params.append('q', debouncedSearch);
        }
        if (statusFilter !== 'all') {
          params.append('status', statusFilter);
        }
        if (headFilter) {
          params.append('head', headFilter);
        }

        const response = await apiGet(`/api/student/vocab/?${params.toString()}`);
        setData(response);
      } catch (err) {
        console.error(err);
        setError('語彙の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [debouncedSearch, statusFilter, headFilter, page, pageSize]);

  const handleRowClick = (vocabId: string) => {
    router.push(`/student/vocab/${vocabId}`);
  };

  const handleStatusFilterChange = (status: LearningStatus | 'all') => {
    setStatusFilter(status);
    setPage(1);
  };

  const handleHeadFilterChange = (letter: string | null) => {
    setHeadFilter(letter);
    setPage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  return (
    <div className="max-w-7xl mx-auto py-10 space-y-6 px-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">語彙一覧</h1>
          <p className="text-slate-600">英単語を辞書的に検索・閲覧できます。</p>
        </div>
        <Link href="/student/dashboard" className="text-indigo-600 font-semibold hover:text-indigo-800">
          ← ダッシュボードへ戻る
        </Link>
      </div>

      {/* 検索ボックス */}
      <div className="bg-white shadow rounded-lg p-4">
        <label htmlFor="search" className="block text-sm font-medium text-slate-700 mb-2">
          検索（英単語 or 日本語訳）
        </label>
        <input
          id="search"
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="例: apple, りんご"
          className="w-full border border-slate-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* 学習ステータスフィルタ */}
      <div className="bg-white shadow rounded-lg p-4">
        <p className="text-sm font-medium text-slate-700 mb-2">学習ステータス</p>
        <div className="flex flex-wrap gap-2">
          {(['all', 'unlearned', 'weak', 'learning', 'mastered'] as const).map((status) => (
            <button
              key={status}
              onClick={() => handleStatusFilterChange(status)}
              className={`px-4 py-2 rounded-md font-medium transition ${
                statusFilter === status
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      </div>

      {/* 頭文字フィルタ */}
      <div className="bg-white shadow rounded-lg p-4">
        <p className="text-sm font-medium text-slate-700 mb-2">頭文字</p>
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => handleHeadFilterChange(null)}
            className={`px-3 py-1 rounded font-medium transition ${
              headFilter === null
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            全て
          </button>
          {ALPHABET.map((letter) => (
            <button
              key={letter}
              onClick={() => handleHeadFilterChange(letter)}
              className={`px-3 py-1 rounded font-medium uppercase transition ${
                headFilter === letter
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {letter}
            </button>
          ))}
        </div>
      </div>

      {/* ローディング */}
      {loading && (
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600" />
        </div>
      )}

      {/* エラー */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* 語彙一覧テーブル */}
      {!loading && !error && data && (
        <>
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      英単語
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      品詞
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      主訳
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      正答率
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      演習数
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      ステータス
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {data.results.map((vocab) => (
                    <tr
                      key={vocab.id}
                      onClick={() => handleRowClick(vocab.id)}
                      className="hover:bg-slate-50 cursor-pointer transition"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-slate-900">{vocab.text_en}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-600">{vocab.part_of_speech || '—'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-600">{vocab.primary_translation || '—'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {vocab.user_status ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-900">
                              {vocab.user_status.correct_rate !== null
                                ? `${vocab.user_status.correct_rate}%`
                                : '—'}
                            </span>
                            {vocab.user_status.correct_rate !== null && (
                              <div className="w-16 bg-slate-200 rounded-full h-2">
                                <div
                                  className="bg-indigo-600 h-2 rounded-full"
                                  style={{ width: `${vocab.user_status.correct_rate}%` }}
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-600">
                          {vocab.user_status ? vocab.user_status.total_answer_count : 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {vocab.user_status ? (
                          <span
                            className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              STATUS_COLORS[vocab.user_status.status]
                            }`}
                          >
                            {STATUS_LABELS[vocab.user_status.status]}
                          </span>
                        ) : (
                          <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-700">
                            未学習
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.results.length === 0 && (
              <div className="px-6 py-8 text-center text-slate-500">
                条件に一致する語彙が見つかりませんでした。
              </div>
            )}
          </div>

          {/* ページング */}
          {data.count > pageSize && (
            <div className="flex items-center justify-between bg-white shadow rounded-lg px-6 py-4">
              <div className="text-sm text-slate-700">
                全 {data.count} 件中 {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, data.count)} 件を表示
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={!data.previous}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md font-medium disabled:bg-slate-300 disabled:cursor-not-allowed hover:bg-indigo-700 transition"
                >
                  前へ
                </button>
                <span className="px-4 py-2 text-slate-700">ページ {page}</span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!data.next}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md font-medium disabled:bg-slate-300 disabled:cursor-not-allowed hover:bg-indigo-700 transition"
                >
                  次へ
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
