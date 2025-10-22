'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/api-utils';
import type { Vocabulary, VocabTranslation } from '@/types/quiz';

interface Row {
  vocab: Vocabulary;
  translations: VocabTranslation[];
}

export default function VocabularyPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const vocabResponse = await apiGet('/api/vocabularies/?page_size=50');
        const vocabularies: Vocabulary[] = Array.isArray(vocabResponse)
          ? vocabResponse
          : vocabResponse?.results || [];

        const translations = await Promise.all(
          vocabularies.map((vocab) =>
            apiGet(`/api/vocab-translations/?vocabulary=${vocab.vocabulary_id}`).catch(() => ({ results: [] })),
          ),
        );

        const rowsData: Row[] = vocabularies.map((vocab, index) => {
          const entry = translations[index];
          const list: VocabTranslation[] = Array.isArray(entry)
            ? entry
            : entry?.results || [];
          return { vocab, translations: list };
        });

        setRows(rowsData);
      } catch (err) {
        console.error(err);
        setError('語彙の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto py-10">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-10 space-y-6 px-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">語彙一覧</h1>
          <p className="text-slate-600">最新の語彙50件まで表示します。</p>
        </div>
        <Link href="/student/dashboard" className="text-indigo-600 font-semibold">← ダッシュボードへ戻る</Link>
      </div>

      <div className="bg-white shadow rounded-lg divide-y">
        <div className="grid grid-cols-4 gap-4 px-6 py-3 text-sm font-semibold text-slate-500">
          <div>英単語</div>
          <div>品詞</div>
          <div>可視性</div>
          <div>訳語</div>
        </div>
        {rows.map(({ vocab, translations }) => (
          <div key={vocab.vocabulary_id} className="grid grid-cols-4 gap-4 px-6 py-4 text-sm">
            <div className="text-slate-700 font-semibold">{vocab.text_en}</div>
            <div className="text-slate-600">{vocab.part_of_speech || '---'}</div>
            <div className="text-slate-600">{vocab.visibility} / {vocab.status}</div>
            <div className="text-slate-600">
              {translations.length > 0
                ? translations.map((t) => (
                    <span key={t.vocab_translation_id} className="inline-block mr-2">
                      {t.text_ja}{t.is_primary ? '⭐️' : ''}
                    </span>
                  ))
                : '---'}
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="px-6 py-8 text-center text-slate-500">語彙が登録されていません。</div>
        )}
      </div>
    </div>
  );
}
