'use client';


import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useEffect, useMemo, useState } from 'react';
import { quizAPI } from '@/services/api';
import { useSearchParams } from 'next/navigation';

export default function QuizStart() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [focusMode, setFocusMode] = useState<'none'|'weak'|'unseen'|'learned'|'strong'>('none');
  const [focusLevel, setFocusLevel] = useState<number | 'all'>(1);
  const [counts, setCounts] = useState<{ total?: Record<string, number> } | null>(null);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [starting, setStarting] = useState(false);

  // レベルは1レベル=約100問想定
  const levels = [
    { value: 1, label: 'レベル1', description: '最初の100語' },
    { value: 2, label: 'レベル2', description: '101〜200語' },
    { value: 3, label: 'レベル3', description: '201〜300語' },
    { value: 4, label: 'レベル4', description: '301〜400語' },
    { value: 5, label: 'レベル5', description: '401〜500語' },
  ];

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!session) {
    router.push('/auth/signin');
    return null;
  }

  // 初期フォーカス指定 (?focus=weak|unseen|learned|strong)
  useEffect(() => {
    const f = searchParams.get('focus');
    if (f && ['weak', 'unseen', 'learned', 'strong'].includes(f)) {
      setFocusMode(f as any);
    }
  }, [searchParams]);

  // フォーカス件数の取得
  useEffect(() => {
    const run = async () => {
      if (focusMode === 'none') {
        setCounts(null);
        return;
      }
      setLoadingCounts(true);
      try {
        let token = (session as any)?.backendAccessToken;
        if (!token && typeof update === 'function') {
          try {
            const refreshed = await update();
            token = (refreshed as any)?.backendAccessToken;
          } catch {}
        }
        const res = await quizAPI.getFocusStatusCounts({ level: focusLevel }, token);
        setCounts(res);
      } catch (e) {
        console.error('focus counts failed', e);
      } finally {
        setLoadingCounts(false);
      }
    };
    run();
  }, [focusMode, focusLevel, session]);

  const totalByStatus = useMemo(() => counts?.total || {}, [counts]);

  const focusModeLabel = (m: string) => ({ unseen: '未学習', weak: '苦手', learned: '学習済み', strong: '得意' } as any)[m] || '';

  const handleStartFocus = async () => {
    if (focusMode === 'none') return;
    setStarting(true);
    try {
      let token = (session as any)?.backendAccessToken;
      if (!token && typeof update === 'function') {
        try {
          const refreshed = await update();
          token = (refreshed as any)?.backendAccessToken;
        } catch {}
      }
      const resp = await quizAPI.startFocus({ status: focusMode, level: focusLevel, count: 10, extend: focusLevel !== 'all' }, token!);
      if (!resp?.started) {
        alert(`対象が見つかりませんでした。(${resp?.message || '対象0'})`);
        setStarting(false);
        return;
      }
      if (resp.available < resp.requested) {
        const proceed = confirm(`${focusModeLabel(focusMode)}は${resp.available}件しかありません。\nこのまま${resp.available}問で始めますか？`);
        if (!proceed) {
          // 範囲を広げる提案
          if (focusLevel !== 'all') {
            const expand = confirm('範囲を「全レベル」に広げて補完しますか？');
            if (expand) {
              setFocusLevel('all');
              setStarting(false);
              // 次のレンダリング後に開始（小さな遅延）
              setTimeout(() => handleStartFocus(), 50);
              return;
            }
          }
          setStarting(false);
          return;
        }
      }
      const quizSetId = resp?.quiz_set?.id || resp?.quiz_set?.quiz_set?.id || resp?.quiz_set_id;
      if (!quizSetId) throw new Error('quiz set id missing');
      router.push(`/quiz/${quizSetId}`);
    } catch (e: any) {
      console.error('start focus failed', e);
      alert('フォーカス学習の開始に失敗しました\n' + (e?.message || ''));
      setStarting(false);
    }
  };

  const handleLevelSelect = (level: number) => {
    router.push(`/quiz/start/level/${level}`);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">クイズ開始</h1>
        <p className="mt-2 text-gray-600">通常のレベル選択か、フォーカス学習（苦手/未学習など）を選べます。</p>
      </div>

      {/* フォーカス学習セクション */}
      <div className="bg-white rounded-lg shadow p-5 space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">フォーカス学習</h2>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'weak', label: '苦手だけ10問' },
            { key: 'unseen', label: '未学習だけ10問' },
            { key: 'learned', label: '学習済みだけ10問' },
            { key: 'strong', label: '得意だけ10問' },
          ].map(b => (
            <button
              key={b.key}
              onClick={() => setFocusMode(b.key as any)}
              className={`px-3 py-2 rounded border ${focusMode===b.key? 'bg-indigo-600 text-white border-indigo-600':'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            >{b.label}</button>
          ))}
        </div>

        {focusMode !== 'none' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-700">対象レベル</label>
              <select
                className="border rounded px-2 py-1"
                value={String(focusLevel)}
                onChange={e => setFocusLevel(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              >
                <option value="all">全レベル</option>
                {levels.map(l => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
              {loadingCounts ? (
                <span className="text-sm text-gray-500">カウント取得中…</span>
              ) : (
                <span className="text-sm text-gray-700">対象件数: {totalByStatus[focusMode as any] ?? '-'}</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleStartFocus}
                disabled={starting}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-60"
              >{starting ? '開始中…' : `${focusModeLabel(focusMode)}で始める`}</button>
              <button
                onClick={() => setFocusMode('none')}
                className="px-3 py-2 border rounded text-gray-700"
              >キャンセル</button>
            </div>

            <p className="text-xs text-gray-500">足りない場合は開始前に件数をお知らせし、必要ならレベルを「全レベル」に広げて補完できます。</p>
          </div>
        )}
      </div>

      {/* 従来のレベル選択 */}
      <div className="grid grid-cols-1 gap-6">
        {levels.map((level) => (
          <button
            key={level.value}
            onClick={() => handleLevelSelect(level.value)}
            className="w-full flex items-center p-6 border-2 rounded-lg cursor-pointer transition-colors border-gray-200 hover:border-indigo-500 hover:bg-indigo-50"
          >
            <div className="ml-3 text-left">
              <p className="text-lg font-medium text-gray-900">{level.label}</p>
              <p className="text-sm text-gray-600">{level.description}</p>
            </div>
          </button>
        ))}
      </div>
      <div className="mt-8 text-center">
        <Link href="/dashboard" className="text-indigo-600 hover:underline">ダッシュボードに戻る</Link>
      </div>
    </div>
  );
}
