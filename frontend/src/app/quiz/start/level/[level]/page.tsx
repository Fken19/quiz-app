"use client";

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { v2API } from '@/services/api';
import { useMemo, useState } from 'react';

export default function QuizLevelPage() {
  const { data: session, status, update } = useSession();
  console.log('session:', session, 'status:', status);
  const router = useRouter();
  const params = useParams();
  const level = parseInt(params.level as string);
  const [loading, setLoading] = useState(false);

  // 注意: v2ではセクションはDB側のSegment（UUID）に対応。ここでは初回クリック時に取得する簡易UXにする。
  const [segments, setSegments] = useState<Array<{ id: string; label: string; description?: string }>>([]);
  const [loaded, setLoaded] = useState(false);
  const TOTAL_UI_SECTIONS = 10;

  const buildUiSegments = (list: Array<{ id: string; label: string }>) => {
    const slot: Record<number, { id: string; label: string }> = {};
    list.forEach((s, idx) => {
      const m = (s.label || '').match(/(\d+)/);
      const n = m ? parseInt(m[1], 10) : (idx + 1);
      if (n >= 1 && n <= TOTAL_UI_SECTIONS && !slot[n]) {
        slot[n] = { id: s.id, label: s.label };
      }
    });
    return Array.from({ length: TOTAL_UI_SECTIONS }, (_, i) => {
      const idx = i + 1;
      const mapped = slot[idx];
      return {
        id: mapped?.id ?? String(idx),
        label: `セクション${idx}`,
        available: !!mapped,
      } as { id: string; label: string; available: boolean };
    });
  };

  // UI 用に 1..10 のスロットを固定表示し、存在しないセグメントは「準備中」として無効化
  const uiSegments = useMemo(() => {
    return buildUiSegments(segments);
  }, [segments]);

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

  const ensureSegments = async (token: string): Promise<Array<{ id: string; label: string; description?: string }>> => {
    if (loaded) return segments;
    // 本来は /api/v2/levels/ から選択レベルの UUID を解決するが、
    // この画面は /quiz/start/level/[level] (旧レベル番号) のため暫定として level_name に "レベル{level}" がある前提で解決する試作
    // 運用では、前画面で level_id(UUID) を保持して渡すのが理想。
    const levels = await v2API.getLevels(token);
    const displayName = `レベル${level}`;
    const matched = (Array.isArray(levels) ? levels : []).find((lv: any) => lv.level_name === displayName) || (levels as any)[level-1];
    const levelId = matched?.level_id;
    if (!levelId) throw new Error('v2 Level を解決できませんでした');
    const segs = await v2API.getSegments(levelId, token);
    const mapped = segs.map((s: any) => ({ id: s.segment_id ?? s.id, label: s.segment_name ?? s.label }));
    setSegments(mapped);
    setLoaded(true);
    return mapped;
  };

  const handleSegmentSelect = async (segmentIdOrIndex: string | number) => {
    setLoading(true);
    try {
      let token = session?.backendAccessToken;
      console.log('handleSegmentSelect token (before refresh):', token);

      // フロント側セッションにトークンがない場合は update() で再取得を試みる
      if (!token && typeof update === 'function') {
        try {
          const refreshed = await update();
          token = (refreshed as any)?.backendAccessToken;
          console.log('handleSegmentSelect token (after refresh):', token);
        } catch (e) {
          console.warn('session.update() failed', e);
        }
      }

      if (!token) throw new Error('No backendAccessToken');

      // セグメント一覧を初回に取得（戻り値を使って同フレーム内のステート未反映問題を回避）
  const ensuredSegments = await ensureSegments(token);
  const effectiveSegments = ensuredSegments && ensuredSegments.length ? ensuredSegments : segments;
  const effectiveUiSegments = buildUiSegments(effectiveSegments);
      
      console.log('Debug: segments after ensureSegments:', effectiveSegments);
      console.log('Debug: segmentIdOrIndex:', segmentIdOrIndex);

      // segmentId を決定（index指定された場合は配列から）
      let segId: string | undefined;
      if (typeof segmentIdOrIndex === 'string') {
        segId = segmentIdOrIndex;
      } else {
        const index = Number(segmentIdOrIndex) - 1;
        // UI 側は 1..10 固定のため、該当スロットが available でない場合は中断
        const ui = effectiveUiSegments[index];
        console.log('Debug: trying to get segment at index', index, 'from segments:', effectiveSegments.length, 'ui.available:', ui?.available);
        if (!ui || !ui.available) {
          throw new Error(`セクション${index + 1}は準備中です`);
        }
        segId = ui.id; // UI スロットから確定 ID を取得
        console.log('Debug: resolved segId:', segId);
      }
      
      if (!segId) {
        console.error('Could not resolve segId. segments:', effectiveSegments, 'segmentIdOrIndex:', segmentIdOrIndex);
        throw new Error('セグメントが選択できませんでした');
      }

      // セッション作成（v2）
      const sessionRes = await v2API.createSession(segId, token);
      // createSession の戻り値に id があることを確認
      if (!sessionRes || !sessionRes.id) {
        console.error('createSession returned unexpected response:', sessionRes);
        throw new Error('セッション作成に失敗しました（不正なレスポンス）');
      }
      // 画面遷移（新しいクイズ詳細ページが sessionId を受け取る想定）
      router.push(`/quiz/session/${sessionRes.id}`);
    } catch (error) {
      setLoading(false);
      console.error('クイズ作成エラー:', error);
      alert('クイズの作成に失敗しました\n' + (error instanceof Error ? error.message : ''));
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">セクション選択</h1>
        <p className="mt-2 text-gray-600">レベル{level}の10問単位のセクションを選んでください。</p>
      </div>
      <div className="grid grid-cols-1 gap-6">
        {(segments.length ? segments : Array.from({ length: 10 }, (_, i) => ({ id: String(i+1), label: `セクション${i+1}` })) ).map((segment, i) => (
          <button
            key={segment.id}
            onClick={() => handleSegmentSelect(segments.length ? segment.id : Number(i+1))}
            disabled={loading}
            className="w-full flex items-center p-6 border-2 rounded-lg cursor-pointer transition-colors border-gray-200 hover:border-indigo-500 hover:bg-indigo-50 disabled:opacity-50"
          >
            <div className="ml-3 text-left">
              <p className="text-lg font-medium text-gray-900">{segment.label}</p>
            </div>
          </button>
        ))}
      </div>
      <div className="mt-8 text-center">
        <Link href="/quiz/start" className="text-indigo-600 hover:underline">レベル選択に戻る</Link>
      </div>
    </div>
  );
}
