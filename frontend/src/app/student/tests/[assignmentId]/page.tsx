'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getStudentTestDetail } from '@/lib/api/test';
import type { StudentTestDetailResponse } from '@/types/test';

export default function TestDetailPage() {
  const router = useRouter();
  const params = useParams();
  const assignmentId = params.assignmentId as string;

  const [detail, setDetail] = useState<StudentTestDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const response = await getStudentTestDetail(assignmentId);
        setDetail(response);
      } catch (err) {
        console.error(err);
        setError('テスト詳細の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    if (assignmentId) {
      fetchDetail();
    }
  }, [assignmentId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="max-w-3xl mx-auto py-10 px-4">
        <p className="text-red-600 mb-4">{error || 'テスト情報を取得できません'}</p>
        <Link href="/student/tests" className="text-indigo-600 font-semibold">← テスト一覧へ戻る</Link>
      </div>
    );
  }

  const { test, questions } = detail;

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-6">
      {/* ヘッダー */}
      <div>
        <Link href="/student/tests" className="text-indigo-600 font-semibold mb-4 inline-block">← テスト一覧へ戻る</Link>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">{test.title}</h1>
        {test.description && <p className="text-slate-600">{test.description}</p>}
      </div>

      {/* テスト情報 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <span className="text-sm font-semibold text-slate-600">最大受験回数</span>
            <p className="text-2xl font-bold text-slate-900">{test.max_attempts}回</p>
          </div>
          <div>
            <span className="text-sm font-semibold text-slate-600">出題数</span>
            <p className="text-2xl font-bold text-slate-900">{questions.length}問</p>
          </div>
        </div>
      </div>

      {/* 問題一覧 */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">問題一覧</h2>
        
        {questions.map((q) => (
          <div key={q.question_order} className="bg-white shadow rounded-lg p-6 border-l-4 border-indigo-600">
            <div className="flex items-start gap-6">
              {/* 問題番号 */}
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100">
                  <span className="text-indigo-700 font-bold">{q.question_order}</span>
                </div>
              </div>

              {/* 語彙情報 */}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{q.vocabulary.text_en}</h3>

                {/* 語彙情報詳細 */}
                <div className="bg-slate-50 rounded p-4 mb-4 space-y-2">
                  {q.vocabulary.part_of_speech && (
                    <div>
                      <span className="text-xs font-semibold text-slate-500 uppercase">品詞</span>
                      <p className="text-slate-700">{q.vocabulary.part_of_speech}</p>
                    </div>
                  )}

                  {q.vocabulary.explanation && (
                    <div>
                      <span className="text-xs font-semibold text-slate-500 uppercase">説明</span>
                      <p className="text-slate-700">{q.vocabulary.explanation}</p>
                    </div>
                  )}

                  {(q.vocabulary.example_en || q.vocabulary.example_ja) && (
                    <div>
                      <span className="text-xs font-semibold text-slate-500 uppercase">例文</span>
                      {q.vocabulary.example_en && <p className="text-slate-700 italic">{q.vocabulary.example_en}</p>}
                      {q.vocabulary.example_ja && <p className="text-slate-600">{q.vocabulary.example_ja}</p>}
                    </div>
                  )}
                </div>

                {/* 訳 */}
                <div className="mb-4">
                  <span className="text-xs font-semibold text-slate-500 uppercase">日本語訳</span>
                  <div className="flex gap-2 flex-wrap mt-2">
                    {q.vocabulary.translations.map((t, idx) => (
                      <div
                        key={idx}
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          t.is_primary ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-700'
                        } ${t.is_override ? 'border-2 border-blue-500' : ''}`}
                      >
                        {t.text_ja}
                        {t.is_override && <span className="ml-1 text-xs">(カスタム)</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 選択肢 */}
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase">選択肢</span>
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    {q.vocabulary.choices.map((choice, idx) => (
                      <div
                        key={choice.id}
                        className="px-4 py-3 border border-slate-300 rounded-lg bg-white text-slate-700 font-medium hover:bg-slate-50 transition"
                      >
                        {String.fromCharCode(65 + idx)}) {choice.text_ja}
                      </div>
                    ))}
                  </div>
                </div>

                {/* タイマー情報 */}
                {q.timer_seconds && (
                  <div className="mt-4 text-sm text-slate-500 flex items-center gap-2">
                    <span className="font-semibold">⏱ {q.timer_seconds}秒</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 受験開始ボタン */}
      <div className="flex gap-4 pt-6 border-t border-slate-200">
        <button
          onClick={() => {
            // Phase 2 で実装：router.push(`/student/tests/${assignmentId}/attempt`)
            alert('受験機能は現在準備中です');
          }}
          className="px-6 py-3 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition"
        >
          受験を開始する
        </button>
        <Link
          href="/student/tests"
          className="px-6 py-3 rounded-lg font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition inline-block"
        >
          キャンセル
        </Link>
      </div>
    </div>
  );
}
