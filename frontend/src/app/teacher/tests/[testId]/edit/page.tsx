'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  getTeacherVocabularies,
  getTeacherVocabularyDetail,
  getTest,
  getTestQuestionSummaries,
  replaceTestQuestions,
  updateTest,
} from '@/lib/api/test';
import type {
  TeacherVocabularyDetail,
  TeacherVocabularyListItem,
} from '@/types/test';
import type { PaginatedResponse } from '@/types/quiz';

const PAGE_SIZE = 50;

export default function TeacherTestEditPage() {
  const params = useParams();
  const testId = params.testId as string;
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [vocabResponse, setVocabResponse] = useState<PaginatedResponse<TeacherVocabularyListItem> | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingTest, setLoadingTest] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [selectedMap, setSelectedMap] = useState<Record<string, TeacherVocabularyListItem>>({});
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewCache, setPreviewCache] = useState<Record<string, TeacherVocabularyDetail>>({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const selectedList = useMemo(() => Object.values(selectedMap), [selectedMap]);
  const previewItem = useMemo(
    () => (previewId ? previewCache[previewId] : null),
    [previewId, previewCache]
  );

  const fetchVocabularies = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getTeacherVocabularies({
        q: query || undefined,
        page,
        page_size: PAGE_SIZE,
      });
      setVocabResponse(response);
    } catch (err) {
      console.error(err);
      setError('語彙一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const fetchTest = async () => {
    try {
      setLoadingTest(true);
      setError(null);
      const [testData, questions] = await Promise.all([
        getTest(testId),
        getTestQuestionSummaries(testId),
      ]);
      setTitle(testData.title);
      setDescription(testData.description || '');
      const nextSelected = questions.reduce<Record<string, TeacherVocabularyListItem>>((acc, item) => {
        acc[item.vocabulary_id] = item;
        return acc;
      }, {});
      setSelectedMap(nextSelected);
      setPreviewId(questions.length > 0 ? questions[0].vocabulary_id : null);
    } catch (err) {
      console.error(err);
      setError('テスト内容の取得に失敗しました');
    } finally {
      setLoadingTest(false);
    }
  };

  useEffect(() => {
    fetchVocabularies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, page]);

  useEffect(() => {
    fetchTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  useEffect(() => {
    if (!previewId) return;
    if (previewCache[previewId]) return;
    let canceled = false;
    const fetchDetail = async () => {
      try {
        setPreviewLoading(true);
        setPreviewError(null);
        const detail = await getTeacherVocabularyDetail(previewId);
        if (canceled) return;
        setPreviewCache((prev) => ({ ...prev, [previewId]: detail }));
      } catch (err) {
        if (canceled) return;
        console.error(err);
        setPreviewError('語彙詳細の取得に失敗しました');
      } finally {
        if (!canceled) setPreviewLoading(false);
      }
    };
    fetchDetail();
    return () => {
      canceled = true;
    };
  }, [previewId, previewCache]);

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    setQuery(queryInput.trim());
  };

  const handleAddVocabulary = (vocab: TeacherVocabularyListItem) => {
    setSelectedMap((prev) => {
      if (prev[vocab.vocabulary_id]) return prev;
      return { ...prev, [vocab.vocabulary_id]: vocab };
    });
    setPreviewId(vocab.vocabulary_id);
  };

  const handleRemoveVocabulary = (vocabId: string) => {
    setSelectedMap((prev) => {
      if (!prev[vocabId]) return prev;
      const next = { ...prev };
      delete next[vocabId];
      return next;
    });
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('タイトルを入力してください');
      return;
    }
    if (selectedList.length === 0) {
      setError('語彙を1件以上追加してください');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      setActionMessage(null);
      await Promise.all([
        updateTest(testId, {
          title: trimmedTitle,
          description: description.trim() || null,
        }),
        replaceTestQuestions(testId, {
          vocabulary_ids: selectedList.map((item) => item.vocabulary_id),
        }),
      ]);
      setActionMessage('保存しました');
    } catch (err) {
      console.error(err);
      setError('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const totalPages = vocabResponse ? Math.ceil(vocabResponse.count / PAGE_SIZE) : 1;
  const currentItems = vocabResponse?.results || [];

  if (loadingTest) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">テスト内容編集</h1>
          <p className="text-slate-600">語彙や設定を編集して保存します。</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push(`/teacher/tests/${testId}`)}
            className="inline-flex items-center px-4 py-2 rounded-md border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"
          >
            詳細へ戻る
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? '保存中...' : '変更を保存'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {actionMessage && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {actionMessage}
        </div>
      )}

      <div className="rounded-lg bg-white p-6 shadow space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">タイトル</label>
          <input
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例: 中1 Unit1"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">説明（任意）</label>
          <textarea
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="任意"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="rounded-lg bg-white shadow p-6 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <div className="text-sm font-semibold text-slate-900">語彙一覧</div>
              <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
                <input
                  className="w-64 rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
                  value={queryInput}
                  onChange={(event) => setQueryInput(event.target.value)}
                  placeholder="検索（英単語 / 訳）"
                />
                <button
                  type="submit"
                  className="px-3 py-2 rounded-md border border-slate-300 text-sm text-slate-700 hover:bg-slate-50"
                >
                  検索
                </button>
              </form>
              <p className="text-xs text-slate-500">
                タグ/難易度フィルタはデータ未整備のため一旦検索のみ対応しています。
              </p>
            </div>
            <div className="text-xs text-slate-500">
              {vocabResponse ? `全 ${vocabResponse.count} 件` : ''}
            </div>
          </div>

          <div className="rounded border border-slate-200">
            {loading ? (
              <div className="p-4 text-sm text-slate-500">読み込み中...</div>
            ) : currentItems.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">語彙が見つかりません。</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {currentItems.map((item) => {
                  const selected = Boolean(selectedMap[item.vocabulary_id]);
                  const isPreview = previewId === item.vocabulary_id;
                  return (
                    <li
                      key={item.vocabulary_id}
                      className={`flex items-center justify-between px-4 py-3 transition ${
                        isPreview ? 'bg-slate-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setPreviewId(item.vocabulary_id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setPreviewId(item.vocabulary_id);
                          }
                        }}
                        className="flex-1 cursor-pointer text-left"
                      >
                        <div className="text-sm font-medium text-slate-900">{item.text_en}</div>
                        <div className="text-xs text-slate-500">
                          {item.primary_translation || '-'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddVocabulary(item)}
                        disabled={selected}
                        className="px-3 py-1 rounded-md border border-slate-300 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {selected ? '追加済み' : '追加'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between text-sm text-slate-600">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="px-3 py-1 rounded border border-slate-300 disabled:opacity-50"
            >
              前へ
            </button>
            <span>
              {page} / {Math.max(totalPages, 1)}
            </span>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 rounded border border-slate-300 disabled:opacity-50"
            >
              次へ
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg bg-white p-6 shadow space-y-3">
            <div className="text-sm font-semibold text-slate-900">プレビュー</div>
            <div className="rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {previewLoading ? (
                <div className="text-sm text-slate-500">読み込み中...</div>
              ) : previewError ? (
                <div className="text-sm text-red-600">{previewError}</div>
              ) : previewItem ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-base font-semibold text-slate-900">{previewItem.text_en}</div>
                    <div className="text-xs text-slate-500">
                      品詞: {previewItem.part_of_speech || '-'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-500">翻訳</div>
                    {previewItem.translations.length === 0 ? (
                      <div className="text-sm text-slate-500">-</div>
                    ) : (
                      <ul className="space-y-1 text-sm text-slate-700">
                        {previewItem.translations.map((translation) => (
                          <li key={translation.vocab_translation_id}>
                            {translation.text_ja}
                            {translation.is_primary ? '（主）' : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-500">説明</div>
                    <div className="text-sm text-slate-700">
                      {previewItem.explanation || '-'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-500">例文</div>
                    <div className="text-sm text-slate-700">
                      {previewItem.example_en || '-'}
                    </div>
                    <div className="text-sm text-slate-500">
                      {previewItem.example_ja || '-'}
                    </div>
                  </div>
                  {previewItem.choices.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-500">選択肢</div>
                      <ul className="space-y-1 text-sm text-slate-700">
                        {previewItem.choices.map((choice) => (
                          <li
                            key={choice.vocab_choice_id}
                            className={`rounded border px-2 py-1 ${
                              choice.is_correct
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-slate-200 bg-white text-slate-700'
                            }`}
                          >
                            {choice.text_ja}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-slate-500">
                  語彙一覧から項目を選択すると詳細が表示されます。
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow space-y-3">
            <div className="text-sm font-semibold text-slate-900">選択済み</div>
            <div className="text-xs text-slate-500">合計: {selectedList.length} 件</div>
            <div className="max-h-64 overflow-y-auto rounded border border-slate-200">
              {selectedList.length === 0 ? (
                <div className="p-4 text-sm text-slate-500">まだ語彙が選択されていません。</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {selectedList.map((item) => (
                    <li
                      key={item.vocabulary_id}
                      className="flex items-center justify-between px-4 py-2 hover:bg-slate-50"
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setPreviewId(item.vocabulary_id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setPreviewId(item.vocabulary_id);
                          }
                        }}
                        className="flex-1 cursor-pointer text-left"
                      >
                        <div className="text-sm font-medium text-slate-900">{item.text_en}</div>
                        <div className="text-xs text-slate-500">
                          {item.primary_translation || '-'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveVocabulary(item.vocabulary_id)}
                        className="text-xs text-rose-600 hover:text-rose-700 hover:underline"
                      >
                        削除
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
