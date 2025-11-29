"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiPost } from "@/lib/api-utils";
import {
  VocabReportMainCategory,
  VocabReportDetailCategory,
  VocabReportRequest,
  VocabReportResponse,
} from "@/types/quiz";

type Props = {
  vocabId: string;
  vocabTextEn: string;
  environment?: string;
};

const MAIN_OPTIONS: { value: VocabReportMainCategory; label: string }[] = [
  { value: "translation", label: "訳の修正" },
  { value: "part_of_speech", label: "品詞の修正" },
  { value: "example_sentence", label: "例文の修正" },
  { value: "choice_text", label: "選択肢文言の修正" },
  { value: "spelling", label: "スペルの修正" },
  { value: "other", label: "その他" },
];

const DETAIL_OPTIONS: { value: VocabReportDetailCategory; label: string }[] = [
  { value: "wrong_meaning", label: "意味の誤り" },
  { value: "missing_sense", label: "意味の抜け漏れ" },
  { value: "unnatural_ja", label: "不自然な日本語" },
  { value: "typo", label: "誤字・タイプミス" },
  { value: "format_issue", label: "書式の問題" },
  { value: "other", label: "その他" },
];

export default function VocabReportForm({ vocabId, vocabTextEn, environment }: Props) {
  const [mainCategory, setMainCategory] = useState<VocabReportMainCategory>("translation");
  const [detailCategory, setDetailCategory] = useState<VocabReportDetailCategory>("wrong_meaning");
  const [reportedTextEn, setReportedTextEn] = useState<string>(vocabTextEn ?? "");
  const [detailText, setDetailText] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<VocabReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const isValid = useMemo(() => {
    return (
      reportedTextEn.trim().length > 0 &&
      detailText.trim().length >= 5 &&
      detailText.trim().length <= 2000
    );
  }, [reportedTextEn, detailText]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!isValid) {
      setError("入力内容を確認してください（詳細は5文字以上）。");
      return;
    }
    setSubmitting(true);
    try {
      const payload: VocabReportRequest = {
        reported_text_en: reportedTextEn.trim(),
        main_category: mainCategory,
        detail_category: detailCategory,
        detail_text: detailText.trim(),
      };
      const res = await apiPost<VocabReportResponse>(`/api/student/vocab/${vocabId}/report/`, payload);
      setResult(res);
      setDetailText("");
      setShowOverlay(true);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "送信に失敗しました";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div ref={containerRef} className="mt-6 border-t border-gray-200 pt-6" aria-live="polite">
      {showOverlay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => {
            setShowOverlay(false);
            window.location.reload();
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="mx-4 max-w-md rounded-lg bg-white p-6 text-center shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">送信完了しました</h3>
            <p className="mt-2 text-sm text-gray-700">ご協力ありがとうございます！タップで閉じてページを更新します。</p>
            <button
              className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              onClick={(e) => {
                e.stopPropagation();
                setShowOverlay(false);
                window.location.reload();
              }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}
      <h2 className="text-lg font-semibold text-gray-900">語彙の誤り報告</h2>
      <p className="mt-1 text-sm text-gray-600">この語彙に関する修正提案や誤り報告を送信できます。現在の表示を確認しながら入力してください。</p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-900">対象の英語語彙</label>
          <input
            type="text"
            value={reportedTextEn}
            onChange={(e) => setReportedTextEn(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            placeholder="例: price"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-900">大分類</label>
            <select
              value={mainCategory}
              onChange={(e) => setMainCategory(e.target.value as VocabReportMainCategory)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            >
              {MAIN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900">詳細分類</label>
            <select
              value={detailCategory}
              onChange={(e) => setDetailCategory(e.target.value as VocabReportDetailCategory)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            >
              {DETAIL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900">詳しい内容</label>
          <textarea
            value={detailText}
            onChange={(e) => setDetailText(e.target.value)}
            rows={5}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            placeholder="修正提案や根拠、参考URLなど（5〜2000文字）"
          />
          <p className="mt-1 text-xs text-gray-500">{detailText.trim().length} / 2000</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!isValid || submitting}
            className="rounded-md bg-blue-600 px-4 py-2 text-white disabled:opacity-50 hover:bg-blue-700"
          >
            {submitting ? "送信中..." : "報告を送信"}
          </button>
          {result?.success && (
            <span className="text-sm text-green-700">送信しました。ありがとうございました！</span>
          )}
          {error && (
            <span className="text-sm text-red-700">{error}</span>
          )}
        </div>

        <p className="mt-2 text-xs text-gray-500">この機能はレート制限があります（1時間に最大100件/ユーザー）。</p>
      </form>
    </div>
  );
}
