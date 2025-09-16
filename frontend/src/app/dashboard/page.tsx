'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { DashboardStats } from '@/types/quiz';
import { apiGet } from '@/lib/api-utils';
import { normalizeAvatarUrl } from '@/lib/avatar';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<any | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    // プロフィールとダッシュボード統計を取得
    const fetchStats = async () => {
      try {
        try {
          const pData = await apiGet('/user/profile/');
          const p = pData?.user || pData;
          p.avatar_url = normalizeAvatarUrl(p?.avatar_url || p?.avatar) || null;
          setProfile(p);
        } catch (_) {}

        const data = await apiGet('/dashboard/stats/');
        // バックエンドは { total_quizzes, average_score, current_streak, weekly_activity, level, monthly_progress, recent_quiz_sets }
        // フロントのDashboardStatsへ最低限マップ
        const mapped: DashboardStats = {
          total_quiz_sets: Number(data?.total_quizzes || 0),
          total_correct_answers: 0, // 集計未提供
          total_questions: 0, // 集計未提供
          average_score: Number(data?.average_score || 0),
          average_latency_ms: 0, // 集計未提供
          recent_results: [],
          streak_days: Number(data?.current_streak || 0),
          today_quiz_count: Number(data?.weekly_activity || 0),
          today_correct_count: 0,
        };
        setStats(mapped);
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err);
        setError('統計データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [session, status, router]);

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

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          ホーム
        </h1>
        <p className="mt-2 text-gray-600">
          こんにちは、{profile?.display_name || session.user?.name}さん！英単語クイズで学習を進めましょう。
        </p>
      </div>

      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <p className="text-yellow-800">{error}</p>
        </div>
      )}

      {/* 今日のおすすめ */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg p-6 text-white">
        <h2 className="text-xl font-semibold mb-2">今日のおすすめ</h2>
        <p className="mb-4">レベル3の単語セットに挑戦してみませんか？</p>
        <Link
          href="/quiz/start"
          className="inline-flex items-center px-4 py-2 bg-white text-indigo-600 rounded-md hover:bg-gray-100 transition-colors"
        >
          クイズを始める
          <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* 宿題・連絡カード（ダミー） */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-lg shadow flex items-center">
          <div className="p-3 bg-orange-100 rounded-lg mr-4">
            <span className="text-2xl">📝</span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">宿題</p>
            <p className="text-lg font-bold text-gray-900">今週の課題：レベル2 セクション3</p>
            <p className="text-xs text-gray-500">提出期限：9/15</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-lg shadow flex items-center">
          <div className="p-3 bg-cyan-100 rounded-lg mr-4">
            <span className="text-2xl">📢</span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">連絡</p>
            <p className="text-lg font-bold text-gray-900">来週は単語テストがあります</p>
            <p className="text-xs text-gray-500">2025/9/19 実施予定</p>
          </div>
        </div>
      </div>

      {/* 今日の学習サマリー（ダミー） */}
      <div className="bg-white rounded-lg shadow p-5 flex items-center gap-8">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📅</span>
          <span className="text-gray-700 font-semibold">今日の学習数</span>
          <span className="text-xl font-bold text-indigo-600">{stats?.today_quiz_count ?? 3}</span>
          <span className="text-gray-500">回</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl">✅</span>
          <span className="text-gray-700 font-semibold">今日の正答数</span>
          <span className="text-xl font-bold text-green-600">{stats?.today_correct_count ?? 25}</span>
          <span className="text-gray-500">問</span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {/* Streakカード */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-pink-100 rounded-lg">
              <span className="text-2xl">🔥</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">連続学習日数</p>
              <p className="text-2xl font-bold text-gray-900">
                {/* TODO: API連携。今はダミー値 */}
                {stats?.streak_days ?? 5}日
              </p>
            </div>
          </div>
        </div>
        {/* 既存の統計カード */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <span className="text-2xl">📚</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">受験回数</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.total_quiz_sets || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <span className="text-2xl">✅</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">正答数</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.total_correct_answers || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <span className="text-2xl">⭐</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">平均スコア</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.average_score?.toFixed(1) || '0.0'}%
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <span className="text-2xl">⏱️</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">平均反応時間</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.average_latency_ms ? (stats.average_latency_ms / 1000).toFixed(1) + 's' : '0.0s'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* メニューカード＋フォーカス学習導線 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link
          href="/quiz/start"
          className="block bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow"
        >
          <div className="flex items-center">
            <div className="p-3 bg-indigo-100 rounded-lg">
              <span className="text-3xl">🎯</span>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">クイズ開始</h3>
              <p className="text-sm text-gray-600">レベル・セグメントを選んで挑戦</p>
            </div>
          </div>
        </Link>

        {/* フォーカス学習導線 */}
        <Link
          href="/quiz/start?focus=weak"
          className="block bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow"
        >
          <div className="flex items-center">
            <div className="p-3 bg-pink-100 rounded-lg">
              <span className="text-3xl">💡</span>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">苦手だけ10問</h3>
              <p className="text-sm text-gray-600">直近で間違えた単語に集中</p>
            </div>
          </div>
        </Link>

        <Link
          href="/history"
          className="block bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow"
        >
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <span className="text-3xl">📊</span>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">マイ履歴</h3>
              <p className="text-sm text-gray-600">過去の受験結果を確認</p>
            </div>
          </div>
        </Link>

        <Link
          href="/profile"
          className="block bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow"
        >
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <span className="text-3xl">👤</span>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">プロフィール</h3>
              <p className="text-sm text-gray-600">アカウント設定</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
