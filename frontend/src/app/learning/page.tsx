"use client";

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api-utils';
import LoadingSpinner from '@/components/LoadingSpinner';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

type BucketRow = { bucket: string; correct: number; incorrect: number; timeout: number; total: number };

export default function LearningDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [range, setRange] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [summary, setSummary] = useState<{ [k in 'today'|'week'|'month'|'all']: { total_questions: number; avg_score_pct: number; avg_latency_ms: number; avg_accuracy_pct: number } } | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    (async () => {
      try {
  const m = await apiGet('/dashboard/learning-metrics/');
  setMetrics(m);
  setSummary(m?.summary || null);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || '学習データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, [status, session, router]);

  // ゼロ埋め: 過去15日/8週/12ヶ月の連続バケットを生成し、欠損は0で埋める
  const bucketData: BucketRow[] = useMemo(() => {
    const src: BucketRow[] = metrics?.[range] || [];
    const map = new Map<string, BucketRow>();
    const toKey = (d: Date, g: 'daily'|'weekly'|'monthly') => {
      const y = d.getFullYear();
      const m = (d.getMonth()+1).toString().padStart(2,'0');
      const day = d.getDate().toString().padStart(2,'0');
      if (g === 'daily') return `${y}-${m}-${day}`;
      if (g === 'weekly') {
        // 週の開始（月曜）に正規化
        const wd = d.getDay(); // 0=Sun
        const delta = (wd + 6) % 7; // 月曜=0
        const monday = new Date(d);
        monday.setDate(d.getDate() - delta);
        const ym = monday.getFullYear();
        const mm = (monday.getMonth()+1).toString().padStart(2,'0');
        const dd = monday.getDate().toString().padStart(2,'0');
        return `${ym}-${mm}-${dd}`;
      }
      // monthly -> 月初
      return `${y}-${m}-01`;
    };
    const parseBucket = (s: string) => new Date(s);
    // 既存データをマップ化
    for (const r of src) {
      const k = toKey(parseBucket(r.bucket), range);
      map.set(k, { ...r, bucket: k });
    }
    const out: BucketRow[] = [];
    const today = new Date();
    if (range === 'daily') {
      for (let i=14;i>=0;i--) {
        const d = new Date(today);
        d.setDate(today.getDate()-i);
        const k = toKey(d, 'daily');
        out.push(map.get(k) || { bucket: k, correct: 0, incorrect: 0, timeout: 0, total: 0 });
      }
    } else if (range === 'weekly') {
      // 現在週の月曜を起点に、過去7週分と今週で計8週
      const wd = today.getDay();
      const delta = (wd + 6) % 7;
      const start = new Date(today);
      start.setDate(today.getDate() - delta);
      for (let i=7;i>=0;i--) {
        const d = new Date(start);
        d.setDate(start.getDate() - i*7);
        const k = toKey(d, 'weekly');
        out.push(map.get(k) || { bucket: k, correct: 0, incorrect: 0, timeout: 0, total: 0 });
      }
    } else {
      // monthly: 今月含む過去12ヶ月（古→新）
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      for (let i=11;i>=0;i--) {
        const d = new Date(start.getFullYear(), start.getMonth()-i, 1);
        const k = toKey(d, 'monthly');
        out.push(map.get(k) || { bucket: k, correct: 0, incorrect: 0, timeout: 0, total: 0 });
      }
    }
    return out;
  }, [metrics, range]);

  const stackedBarData = useMemo(() => {
    const labels = bucketData.map((r) => new Date(r.bucket).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }));
    // Timeout を不正解に合算し、凡例から Timeout を削除
    const wrongPlusTimeout = bucketData.map((r) => (r.incorrect || 0) + (r.timeout || 0));
    return {
      labels,
      datasets: [
        { label: '正解', data: bucketData.map((r) => r.correct), backgroundColor: 'rgba(16,185,129,0.8)' },
        { label: '不正解', data: wrongPlusTimeout, backgroundColor: 'rgba(245,158,11,0.8)' },
      ],
    };
  }, [bucketData]);

  const stackedBarOptions = {
    responsive: true,
    plugins: { legend: { position: 'bottom' as const } },
    scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
  };

  const streak = metrics?.streak || 0;
  const heatmap7 = (metrics?.heatmap7 || []) as Array<{ date: string; total: number; correct: number }>;

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">学習ダッシュボード</h1>
        <p className="mt-2 text-gray-600">日/週/月の学習量、Streak、直近7日のヒートマップで学習状況を可視化</p>
      </div>

      {/* サマリーカード（期間切替） */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">サマリー</h2>
          <div className="space-x-2">
            {(['today','week','month','all'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-sm rounded-full ${period === p ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >{p === 'today' ? '今日' : p === 'week' ? '今週' : p === 'month' ? '今月' : '全体'}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="p-4 rounded-lg border border-gray-100">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg"><span className="text-xl">�</span></div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-700">総問題数</p>
                <p className="text-2xl font-bold text-black">{summary ? (summary[period]?.total_questions ?? 0) : 0}</p>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-lg border border-gray-100">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg"><span className="text-xl">⭐</span></div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-700">平均スコア</p>
                <p className="text-2xl font-bold text-black">{summary ? (summary[period]?.avg_score_pct ?? 0).toFixed(1) : '0.0'}%</p>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-lg border border-gray-100">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg"><span className="text-xl">⏱️</span></div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-700">平均解答時間</p>
                <p className="text-2xl font-bold text-black">{summary ? (((summary[period]?.avg_latency_ms ?? 0) / 1000).toFixed(1)) : '0.0'}s</p>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-lg border border-gray-100">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg"><span className="text-xl">✅</span></div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-700">平均正答率</p>
                <p className="text-2xl font-bold text-black">{summary ? (summary[period]?.avg_accuracy_pct ?? 0).toFixed(1) : '0.0'}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 範囲切替 + 積み上げ棒グラフ（横スクロール対応） */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">学習量の推移（{range === 'daily' ? '日次(過去15日)' : range === 'weekly' ? '週次(過去8週)' : '月次(過去12ヶ月)'}）</h2>
          <div className="space-x-2">
            {(['daily','weekly','monthly'] as const).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 text-sm rounded-full ${range === r ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >{r === 'daily' ? '日' : r === 'weekly' ? '週' : '月'}</button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <div style={{ minWidth: `${Math.max(600, bucketData.length * 60)}px` }}>
            <Bar data={stackedBarData} options={stackedBarOptions} />
          </div>
        </div>
      </div>

      {/* Streak + 直近7日ヒートマップ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Streak</h2>
          <p className="text-3xl font-bold text-black">{streak} 日</p>
          <p className="text-sm text-gray-600 mt-1">（その日に1回でも学習があれば継続）</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow md:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">直近7日ヒートマップ</h2>
          <div className="grid grid-cols-7 gap-2">
            {heatmap7.map((d) => {
              const ratio = d.total ? d.correct / d.total : 0;
              // 濃さを正解率で決定
              const bg = ratio >= 0.8 ? 'bg-green-600' : ratio >= 0.6 ? 'bg-green-500' : ratio >= 0.4 ? 'bg-green-400' : ratio > 0 ? 'bg-green-300' : 'bg-gray-200';
              return (
                <div key={d.date} className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded ${bg}`} title={`${new Date(d.date).toLocaleDateString('ja-JP')}\n${d.correct}/${d.total} 正解`} />
                  <div className="text-xs text-gray-600 mt-1">{new Date(d.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
