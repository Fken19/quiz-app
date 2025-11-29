"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { apiPost } from "@/lib/api-utils";
import {
  VocabReportRequest,
  VocabReportMainCategory,
  VocabReportDetailCategory,
  VocabReportResponse,
} from "@/types/quiz";

interface VocabReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  vocabId: string;
  vocabTextEn: string;
  onSubmitSuccess?: () => void;
}

const MAIN_CATEGORY_OPTIONS: {
  value: VocabReportMainCategory;
  label: string;
}[] = [
  { value: "translation", label: "訳が間違っている / 足りない" },
  { value: "part_of_speech", label: "品詞が間違っている" },
  { value: "example_sentence", label: "例文が不自然 / 誤り" },
  { value: "choice_text", label: "選択肢の日本語文言がおかしい" },
  { value: "spelling", label: "英単語のスペルミス" },
  { value: "other", label: "その他" },
];

const DETAIL_CATEGORY_OPTIONS: {
  value: VocabReportDetailCategory;
  label: string;
}[] = [
  { value: "wrong_meaning", label: "意味が間違っている" },
  { value: "missing_sense", label: "語義が不足している" },
  { value: "unnatural_ja", label: "日本語が不自然" },
  { value: "typo", label: "誤字・脱字" },
  { value: "format_issue", label: "レイアウト／表記の問題" },
  { value: "other", label: "その他" },
];

export default function VocabReportModal({
  isOpen,
  onClose,
  vocabId,
  vocabTextEn,
  onSubmitSuccess,
}: VocabReportModalProps) {
  const [reportedTextEn, setReportedTextEn] = useState("");
  const [mainCategory, setMainCategory] =
    useState<VocabReportMainCategory>("translation");
  const [detailCategory, setDetailCategory] =
    useState<VocabReportDetailCategory>("wrong_meaning");
  const [detailText, setDetailText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reportedTextEn.trim() || !detailText.trim()) {
      setError("すべての項目を入力してください。");
      return;
    }

    if (detailText.length > 2000) {
      setError("詳細コメントは2000文字以内で入力してください。");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload: VocabReportRequest = {
      reported_text_en: reportedTextEn.trim(),
      main_category: mainCategory,
      detail_category: detailCategory,
      detail_text: detailText.trim(),
    };

    try {
      const response = await apiPost(
        `/api/student/vocab/${vocabId}/report/`,
        payload
      ) as VocabReportResponse;

      setSuccess(true);
      onSubmitSuccess?.();

      // 2秒後にモーダルを閉じる
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("エラーが発生しました。");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset form
    setReportedTextEn("");
    setMainCategory("translation");
    setDetailCategory("wrong_meaning");
    setDetailText("");
    setError(null);
    setSuccess(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="語彙内容の誤り報告">
      {success ? (
        <div className="py-8 text-center">
          <div className="mb-4 text-green-600 font-semibold text-lg">
            ✓ 報告を送信しました
          </div>
          <p className="text-gray-700">ご協力ありがとうございます。</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
              <label className="block text-sm font-bold text-gray-900 mb-1">
              問題のある単語（ユーザー視点）
              <span className="text-red-500 ml-1">*</span>
            </label>
              <input
                type="text"
                value={reportedTextEn}
                onChange={(e) => setReportedTextEn(e.target.value)}
                placeholder={`例）${vocabTextEn} / ability / abillity など`}
                className="w-full px-3 py-2 border border-gray-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-700 text-gray-900 font-bold placeholder-gray-400"
                required
                maxLength={120}
                disabled={isSubmitting}
              />
          </div>

          <div>
              <label className="block text-sm font-bold text-gray-900 mb-1">
              報告の大分類
              <span className="text-red-500 ml-1">*</span>
            </label>
              <select
                value={mainCategory}
                onChange={(e) =>
                  setMainCategory(e.target.value as VocabReportMainCategory)
                }
                className="w-full px-3 py-2 border border-gray-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-700 text-gray-900 font-bold"
                required
                disabled={isSubmitting}
              >
              {MAIN_CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="text-gray-900 font-bold">
                    {opt.label}
                  </option>
              ))}
            </select>
          </div>

          <div>
              <label className="block text-sm font-bold text-gray-900 mb-1">
              報告の詳細分類
              <span className="text-red-500 ml-1">*</span>
            </label>
              <select
                value={detailCategory}
                onChange={(e) =>
                  setDetailCategory(e.target.value as VocabReportDetailCategory)
                }
                className="w-full px-3 py-2 border border-gray-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-700 text-gray-900 font-bold"
                required
                disabled={isSubmitting}
              >
              {DETAIL_CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="text-gray-900 font-bold">
                    {opt.label}
                  </option>
              ))}
            </select>
          </div>

          <div>
              <label className="block text-sm font-bold text-gray-900 mb-1">
              詳細コメント
              <span className="text-red-500 ml-1">*</span>
                <span className="text-gray-900 text-xs ml-2 font-bold">
                  ({detailText.length}/2000文字)
                </span>
            </label>
              <textarea
                value={detailText}
                onChange={(e) => setDetailText(e.target.value)}
                placeholder={`例）現在の訳は「能力」だけですが、「才能」という意味も追加した方がよいと思います。\n例）example_enの文法が怪しい気がします：...`}
                rows={6}
                className="w-full px-3 py-2 border border-gray-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-700 text-gray-900 font-bold placeholder-gray-400"
                required
                maxLength={2000}
                disabled={isSubmitting}
              />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? "送信中..." : "報告を送信"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
