'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getTeacherAssignmentResults,
  downloadTeacherAssignmentResultsCSV,
} from '@/lib/api/test';
import type {
  TeacherAssignmentResultsResponse,
  TeacherAssignmentResult,
} from '@/types/test';

type SortKey = 'name' | 'status' | 'best_score' | 'latest_completed';
type SortOrder = 'asc' | 'desc';
type FilterStatus = 'all' | 'attempted' | 'unattempted' | 'expired_unattempted';

export default function TeacherAssignmentResultsPage() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.assignmentId as string;

  const [data, setData] = useState<TeacherAssignmentResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);
        const response = await getTeacherAssignmentResults(assignmentId);
        setData(response);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '結果の取得に失敗しました';
        console.error('Error fetching results:', err);
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [assignmentId]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const handleDownloadCSV = () => {
    downloadTeacherAssignmentResultsCSV(assignmentId);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700">結果を読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <h1 className="text-2xl font-bold text-red-600 mb-4">エラーが発生しました</h1>
          <p className="text-gray-700 mb-6">{error || '結果を取得できませんでした'}</p>
          <button
            onClick={() => router.back()}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  // フィルタリング
  let filteredRows = data.rows;
  if (filterStatus !== 'all') {
    filteredRows = filteredRows.filter(row => row.status === filterStatus);
  }

  // ソート
  const sortedRows = [...filteredRows].sort((a, b) => {
    let aVal: any;
    let bVal: any;

    switch (sortKey) {
      case 'name':
        aVal = a.student_name;
        bVal = b.student_name;
        break;
      case 'status':
        aVal = a.status;
        bVal = b.status;
        break;
      case 'best_score':
        aVal = a.best_score ?? -1;
        bVal = b.best_score ?? -1;
        break;
      case 'latest_completed':
        aVal = a.latest_completed_at ? new Date(a.latest_completed_at).getTime() : 0;
        bVal = b.latest_completed_at ? new Date(b.latest_completed_at).getTime() : 0;
        break;
      default:
        return 0;
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'attempted':
        return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm font-semibold">受験済</span>;
      case 'unattempted':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-sm font-semibold">未受験</span>;
      case 'expired_unattempted':
        return <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-sm font-semibold">期限切れ未受験</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">{status}</span>;
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                {data.assignment.title}
              </h1>
              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  期間: {formatDateTime(data.assignment.schedule.start_at)} 〜{' '}
                  {formatDateTime(data.assignment.schedule.end_at)}
                </p>
              </div>
            </div>
            <button
              onClick={handleDownloadCSV}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold flex items-center gap-2"
            >
              <span>📥</span>
              CSVダウンロード
            </button>
          </div>

          {/* サマリー */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">対象学生数</p>
              <p className="text-3xl font-bold text-blue-600">{data.summary.assignee_count}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">受験済み</p>
              <p className="text-3xl font-bold text-green-600">{data.summary.attempted_count}</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">未受験</p>
              <p className="text-3xl font-bold text-yellow-600">{data.summary.unattempted_count}</p>
            </div>
          </div>
        </div>

        {/* フィルタ */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded font-semibold ${
                filterStatus === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              全て ({data.rows.length})
            </button>
            <button
              onClick={() => setFilterStatus('attempted')}
              className={`px-4 py-2 rounded font-semibold ${
                filterStatus === 'attempted'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              受験済 ({data.summary.attempted_count})
            </button>
            <button
              onClick={() => setFilterStatus('unattempted')}
              className={`px-4 py-2 rounded font-semibold ${
                filterStatus === 'unattempted'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              未受験 ({data.rows.filter(r => r.status === 'unattempted').length})
            </button>
            <button
              onClick={() => setFilterStatus('expired_unattempted')}
              className={`px-4 py-2 rounded font-semibold ${
                filterStatus === 'expired_unattempted'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              期限切れ ({data.rows.filter(r => r.status === 'expired_unattempted').length})
            </button>
          </div>
        </div>

        {/* テーブル */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('name')}
                  >
                    学生名 {sortKey === 'name' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('status')}
                  >
                    状態 {sortKey === 'status' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    受験回数
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('best_score')}
                  >
                    最高得点 {sortKey === 'best_score' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    最新得点
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('latest_completed')}
                  >
                    最終完了日時 {sortKey === 'latest_completed' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    残り回数
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedRows.map(row => (
                  <tr key={row.assignee_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{row.student_name}</div>
                      <div className="text-sm text-gray-500">{row.student_email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(row.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.completed_count} / {row.attempt_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {row.best_score !== null ? `${row.best_score}点` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.latest_score !== null ? `${row.latest_score}点` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(row.latest_completed_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.remaining_attempts}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 戻るボタン */}
        <div className="mt-6">
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold"
          >
            ← 戻る
          </button>
        </div>
      </div>
    </div>
  );
}
