'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { apiGet } from '@/lib/api-utils';
import type { StudentVocabDetail } from '@/types/quiz';

const STATUS_LABELS = {
  unlearned: '未学習',
  weak: '苦手',
  learning: '学習中',
  mastered: '完璧',
};

const STATUS_COLORS = {
  unlearned: 'bg-gray-100 text-gray-700',
  weak: 'bg-red-100 text-red-700',
  learning: 'bg-yellow-100 text-yellow-700',
  mastered: 'bg-green-100 text-green-700',
};

export default function VocabDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [vocab, setVocab] = useState<StudentVocabDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiGet(`/api/student/vocab/${id}/`);
        setVocab(response);
      } catch (err) {
        console.error(err);
        setError('語彙の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error || !vocab) {
    return (
      <div className="max-w-4xl mx-auto py-10 px-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error || '語彙が見つかりませんでした'}</p>
        </div>
        <div className="mt-4">
          <Link href="/student/vocab" className="text-indigo-600 font-semibold hover:text-indigo-800">
            ← 語彙一覧へ戻る
          </Link>
        </div>
      </div>
    );
  }

  const primaryTranslation = vocab.translations.find((t) => t.is_primary)?.text_ja || vocab.translations[0]?.text_ja;

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{vocab.text_en}</h1>
          {vocab.part_of_speech && (
            <span className="inline-block mt-2 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
              {vocab.part_of_speech}
            </span>
          )}
        </div>
        <Link href="/student/vocab" className="text-indigo-600 font-semibold hover:text-indigo-800">
          ← 語彙一覧へ戻る
        </Link>
      </div>

      {/* 主訳 */}
      {primaryTranslation && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">主な意味</h2>
          <p className="text-2xl text-slate-700">{primaryTranslation}</p>
        </div>
      )}

      {/* 説明・注釈 */}
      {vocab.explanation && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">説明・注釈</h2>
          <p className="text-slate-700 whitespace-pre-wrap">{vocab.explanation}</p>
        </div>
      )}

      {/* 例文 */}
      {(vocab.example_en || vocab.example_ja) && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">例文</h2>
          <div className="space-y-3">
            {vocab.example_en && (
              <div>
                <p className="text-sm text-slate-500 mb-1">英語</p>
                <p className="text-slate-700 italic">{vocab.example_en}</p>
              </div>
            )}
            {vocab.example_ja && (
              <div>
                <p className="text-sm text-slate-500 mb-1">日本語</p>
                <p className="text-slate-700">{vocab.example_ja}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 日本語訳一覧 */}
      {vocab.translations.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">日本語訳一覧</h2>
          <div className="space-y-2">
            {vocab.translations.map((t) => (
              <div key={t.id} className="flex items-center gap-2">
                <span className="text-slate-700">{t.text_ja}</span>
                {t.is_primary && (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded">
                    主訳
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* エイリアス */}
      {(vocab.alias_of || vocab.aliases.length > 0) && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">関連語彙</h2>
          <div className="space-y-3">
            {vocab.alias_of && (
              <div>
                <p className="text-sm text-slate-500 mb-1">エイリアス元</p>
                <Link
                  href={`/student/vocab/${vocab.alias_of.id}`}
                  className="text-indigo-600 font-medium hover:text-indigo-800"
                >
                  {vocab.alias_of.text_en}
                </Link>
              </div>
            )}
            {vocab.aliases.length > 0 && (
              <div>
                <p className="text-sm text-slate-500 mb-2">エイリアス</p>
                <div className="flex flex-wrap gap-2">
                  {vocab.aliases.map((alias) => (
                    <Link
                      key={alias.id}
                      href={`/student/vocab/${alias.id}`}
                      className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium hover:bg-indigo-200"
                    >
                      {alias.text_en}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 学習状況 */}
      {vocab.user_status && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">あなたの学習状況</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-slate-500">ステータス</p>
              <span
                className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                  STATUS_COLORS[vocab.user_status.status]
                }`}
              >
                {STATUS_LABELS[vocab.user_status.status]}
              </span>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-slate-500">総回答数</p>
              <p className="text-2xl font-bold text-slate-900">{vocab.user_status.total_answer_count}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-slate-500">総正解数</p>
              <p className="text-2xl font-bold text-slate-900">{vocab.user_status.total_correct_count}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-slate-500">正答率</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-slate-900">
                  {vocab.user_status.correct_rate !== null ? `${vocab.user_status.correct_rate}%` : '—'}
                </p>
                {vocab.user_status.correct_rate !== null && (
                  <div className="flex-1 bg-slate-200 rounded-full h-3">
                    <div
                      className="bg-indigo-600 h-3 rounded-full"
                      style={{ width: `${vocab.user_status.correct_rate}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-slate-500">連続正解数</p>
              <p className="text-2xl font-bold text-slate-900">{vocab.user_status.recent_correct_streak}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-slate-500">最後の結果</p>
              <span
                className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                  vocab.user_status.last_result === 'correct'
                    ? 'bg-green-100 text-green-700'
                    : vocab.user_status.last_result === 'incorrect'
                      ? 'bg-red-100 text-red-700'
                      : vocab.user_status.last_result === 'timeout'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                }`}
              >
                {vocab.user_status.last_result === 'correct'
                  ? '正解'
                  : vocab.user_status.last_result === 'incorrect'
                    ? '不正解'
                    : vocab.user_status.last_result === 'timeout'
                      ? 'タイムアウト'
                      : '—'}
              </span>
            </div>
          </div>
          {vocab.user_status.last_answered_at && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-sm text-slate-500">
                最終回答日時: {new Date(vocab.user_status.last_answered_at).toLocaleString('ja-JP')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 出題状況 */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">出題状況</h2>
        <p className="text-slate-700">
          これまでクイズ/テストで <span className="font-bold text-indigo-600">{vocab.quiz_count}回</span>{' '}
          出題されています。
        </p>
      </div>

      {/* 将来の拡張用ボタン領域 */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
        <p className="text-sm text-slate-500 mb-4">この単語で復習クイズを開始（準備中）</p>
        <button
          disabled
          className="px-6 py-3 bg-slate-300 text-slate-500 rounded-md font-medium cursor-not-allowed"
        >
          復習クイズを開始
        </button>
      </div>
    </div>
  );
}
