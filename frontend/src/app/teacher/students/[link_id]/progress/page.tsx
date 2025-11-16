'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useParams } from 'next/navigation';
import { apiGet } from '@/lib/api-utils';

interface ProgressSummary {
  student_teacher_link_id: string;
  display_name: string;
  avatar_url?: string | null;
  status: string;
  bio?: string | null;
  last_activity?: string | null;
  groups: { roster_folder_id: string; name: string }[];
  date_from: string;
  date_to: string;
  totals: {
    answer_count: number;
    correct_count: number;
    incorrect_count: number;
    timeout_count: number;
    accuracy: number;
    avg_seconds: number;
  };
  daily_chart: Array<{
    date: string;
    correct_count: number;
    incorrect_count: number;
    timeout_count: number;
    total_time_ms: number;
  }>;
}

export default function TeacherStudentProgressPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const linkId = params?.link_id as string;
  const from = searchParams.get('from');
  const group = searchParams.get('group');

  const [data, setData] = useState<ProgressSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      if (!linkId) return;
      try {
        setLoading(true);
        const res = (await apiGet(`/api/teacher/students/${linkId}/progress/`)) as ProgressSummary;
        setData(res);
      } catch (err) {
        console.error(err);
        setError('学習状況の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [linkId]);

  const dailyTotals = useMemo(() => {
    const chart = data?.daily_chart || [];
    return chart.map((d) => ({
      date: d.date,
      total: d.correct_count + d.incorrect_count + d.timeout_count,
      correct: d.correct_count,
      incorrect: d.incorrect_count,
      timeout: d.timeout_count,
    }));
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-12 w-12 rounded-full border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-5xl mx-auto py-12 px-4">
        <p className="text-red-600">{error || 'データが見つかりませんでした'}</p>
      </div>
    );
  }

  const backLink = from === 'group' && group
    ? { href: `/teacher/groups?folder=${group}`, label: '◀ グループに戻る' }
    : { href: '/teacher/students', label: '◀ 生徒一覧に戻る' };

  return (
    <div className="max-w-6xl mx-auto py-10 space-y-8 px-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">学習状況</h1>
          <p className="text-sm text-slate-600">リンクID: {data.student_teacher_link_id}</p>
        </div>
        <Link href={backLink.href} className="text-indigo-600 font-semibold hover:underline text-sm">
          {backLink.label}
        </Link>
      </div>

      <section className="bg-white shadow rounded-lg p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            {data.avatar_url ? (
              <img src={data.avatar_url} alt={data.display_name} className="w-16 h-16 rounded-full object-cover border border-slate-200" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-xl">
                {(data.display_name || 'S').slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-lg font-semibold text-slate-900">{data.display_name}</p>
              <p className="text-xs text-slate-600">ステータス: {data.status}</p>
              {data.bio && <p className="text-sm text-slate-700 mt-1">{data.bio}</p>}
            </div>
          </div>
          <div className="text-sm text-slate-700 space-y-1">
            <p>期間: {data.date_from} 〜 {data.date_to}</p>
            <p>所属グループ: {(data.groups || []).map((g) => g.name).join(', ') || 'なし'}</p>
            <p>最終学習日時: {data.last_activity ? new Date(data.last_activity).toLocaleString() : '---'}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white shadow rounded-lg p-4">
          <p className="text-xs text-slate-500">回答数</p>
          <p className="text-2xl font-bold text-slate-900">{data.totals.answer_count}</p>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <p className="text-xs text-slate-500">正解率</p>
          <p className="text-2xl font-bold text-slate-900">{data.totals.answer_count ? data.totals.accuracy.toFixed(1) + '%' : '-'}</p>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <p className="text-xs text-slate-500">平均時間</p>
          <p className="text-2xl font-bold text-slate-900">{data.totals.answer_count ? data.totals.avg_seconds.toFixed(1) + '秒' : '-'}</p>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <p className="text-xs text-slate-500">Timeout</p>
          <p className="text-2xl font-bold text-slate-900">{data.totals.timeout_count}</p>
        </div>
      </section>

      <section className="bg-white shadow rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">日別学習量</h2>
          <p className="text-xs text-slate-500">正解 / 不正解 / Timeout</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[640px] w-full text-sm text-slate-800">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="px-3 py-2 text-left">日付</th>
                <th className="px-3 py-2 text-right">合計</th>
                <th className="px-3 py-2 text-right text-green-600">正解</th>
                <th className="px-3 py-2 text-right text-red-500">不正解</th>
                <th className="px-3 py-2 text-right text-amber-600">Timeout</th>
              </tr>
            </thead>
            <tbody>
              {dailyTotals.map((d) => (
                <tr key={d.date} className="border-b last:border-0 border-slate-100">
                  <td className="px-3 py-2">{new Date(d.date).toLocaleDateString('ja-JP')}</td>
                  <td className="px-3 py-2 text-right font-semibold">{d.total}</td>
                  <td className="px-3 py-2 text-right text-green-600">{d.correct}</td>
                  <td className="px-3 py-2 text-right text-red-500">{d.incorrect}</td>
                  <td className="px-3 py-2 text-right text-amber-600">{d.timeout}</td>
                </tr>
              ))}
              {dailyTotals.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-sm text-slate-500">
                    期間内の学習データがありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
