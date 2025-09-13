'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import LoadingSpinner from './LoadingSpinner';
import { apiPost } from '@/lib/api-utils';

interface InviteCodeInputProps {
  onSuccess: (teacherName: string) => void;
  onError: (error: string) => void;
}

interface AcceptCodeResponse {
  message: string;
  link: {
    id: string;
    status: string;
    linked_at: string;
    teacher: {
      id: string;
      display_name: string;
      email: string;
    };
    student: {
      id: string;
      display_name: string;
      email: string;
    };
  };
}

export default function InviteCodeInput({ onSuccess, onError }: InviteCodeInputProps) {
  const { data: session } = useSession();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const formatCode = (value: string): string => {
    // 数字とアルファベットのみを残し、大文字に変換
    const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    
    // ABCD-EF12 形式にフォーマット
    if (cleaned.length <= 4) {
      return cleaned;
    } else if (cleaned.length <= 8) {
      return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
    } else {
      // 8文字を超える場合は切り捨て
      return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}`;
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCode(e.target.value);
    setCode(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!code) {
      onError('招待コードを入力してください');
      return;
    }

    if (!agreed) {
      onError('利用規約に同意してください');
      return;
    }

    // コード形式の検証（ABCD-EF12）
    const codePattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    if (!codePattern.test(code)) {
      onError('招待コードは ABCD-EF12 の形式で入力してください');
      return;
    }

    setLoading(true);

    try {
      const response: AcceptCodeResponse = await apiPost('/student/invite/accept/', {
        code: code,
        agreed: agreed
      });

      // レスポンスにmessageがあれば成功とみなす
      if (response.message) {
        const teacherName = response.link?.teacher?.display_name || response.link?.teacher?.email || '講師';
        onSuccess(teacherName);
        setCode('');
        setAgreed(false);
      } else {
        onError(response.message || '招待コードの使用に失敗しました');
      }
    } catch (error: any) {
      console.error('招待コード使用エラー:', error);
      
      // エラーレスポンスからメッセージを取得
      if (error.response?.data?.message) {
        onError(error.response.data.message);
      } else if (typeof error === 'string') {
        onError(error);
      } else {
        onError('招待コードの使用に失敗しました。コードが正しいか確認してください。');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="inviteCode" className="block text-sm font-medium text-black mb-2">
          招待コード
        </label>
        <input
          type="text"
          id="inviteCode"
          value={code}
          onChange={handleCodeChange}
          placeholder="ここに入力（例: ABCD-EF12）"
          maxLength={9} // ABCD-EF12 = 9文字
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-lg tracking-wider text-center text-black"
          disabled={loading}
        />
        <p className="mt-1 text-xs text-gray-700">
          講師から受け取った8桁のコードを入力してください（例: ABCD-EF12）
        </p>
      </div>

      <div className="bg-blue-50 p-4 rounded-md">
        <h4 className="text-sm font-medium text-blue-900 mb-2">招待コードを使用することで：</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• 講師があなたの学習進捗を確認できるようになります</li>
          <li>• クイズの成績や履歴が講師に共有されます</li>
          <li>• 講師から個別のフィードバックを受けられます</li>
          <li>• いつでも紐付けを解除できます</li>
        </ul>
      </div>

      <div className="flex items-start space-x-2">
        <input
          type="checkbox"
          id="agreement"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          disabled={loading}
        />
        <label htmlFor="agreement" className="text-sm text-black">
          上記の内容に同意し、講師との紐付けを行います
        </label>
      </div>

      <button
        type="submit"
        disabled={loading || !code || !agreed}
        className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {loading ? (
          <>
            <LoadingSpinner size="small" />
            <span className="ml-2">処理中...</span>
          </>
        ) : (
          '招待コードを使用'
        )}
      </button>

      <div className="mt-4 p-3 bg-gray-50 rounded-md">
        <h5 className="text-xs font-medium text-black mb-1">注意事項</h5>
        <ul className="text-xs text-gray-700 space-y-1">
          <li>• 招待コードは1時間で期限切れになります</li>
          <li>• 1つのコードは1回のみ使用できます</li>
          <li>• すでに紐付けられている講師のコードは使用できません</li>
        </ul>
      </div>
    </form>
  );
}
