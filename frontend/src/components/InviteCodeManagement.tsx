'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { apiGet, apiPost } from '@/lib/api-utils';

interface InviteCode {
  id: string;
  code: string;
  issued_at: string;
  expires_at: string;
  used_by: any;
  status: 'active' | 'expired' | 'used' | 'revoked';
  is_valid: boolean;
}

interface CreateCodeParams {
  count: number;
  expires_hours: number;
}

export default function InviteCodeManagement() {
  const { data: session } = useSession();
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createParams, setCreateParams] = useState<CreateCodeParams>({
    count: 1,
    expires_hours: 1
  });

  const fetchCodes = async () => {
    try {
      const data = await apiGet('/teacher/invite-codes/');
      setCodes(data);
    } catch (error) {
      console.error('招待コード取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const createCodes = async () => {
    setCreating(true);
    try {
      const data = await apiPost('/teacher/invite-codes/', createParams);
      setCodes(prev => [...data.codes, ...prev]);
      // 成功通知をここに追加（Toast等）
      alert(data.message);
    } catch (error) {
      console.error('招待コード作成エラー:', error);
      alert(`招待コード作成に失敗しました: ${error}`);
    } finally {
      setCreating(false);
    }
  };

  const revokeCode = async (codeId: string) => {
    if (!confirm('このコードを失効しますか？')) return;

    try {
      const data = await apiPost(`/teacher/invite-codes/${codeId}/revoke/`, {});
      setCodes(prev => prev.map(code => 
        code.id === codeId 
          ? { ...code, status: 'revoked' as const, is_valid: false }
          : code
      ));
      alert(data.message);
    } catch (error) {
      console.error('招待コード失効エラー:', error);
      alert(`招待コード失効に失敗しました: ${error}`);
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    alert(`コード ${code} をコピーしました`);
  };

  const formatRemainingTime = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();

    if (diff <= 0) return '期限切れ';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}時間${minutes}分`;
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      active: 'bg-green-100 text-green-800',
      expired: 'bg-gray-100 text-gray-800',
      used: 'bg-blue-100 text-blue-800',
      revoked: 'bg-red-100 text-red-800'
    };
    
    const labels = {
      active: '有効',
      expired: '期限切れ',
      used: '使用済み',
      revoked: '失効済み'
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${badges[status as keyof typeof badges] || badges.active}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  useEffect(() => {
    if (session?.user?.email) {
      fetchCodes();
    }
  }, [session]);

  if (loading) {
    return <div className="flex justify-center p-8">読み込み中...</div>;
  }

  return (
    <div className="space-y-6">
      {/* コード発行カード */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">招待コード発行</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              発行件数
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={createParams.count}
              onChange={(e) => setCreateParams(prev => ({ 
                ...prev, 
                count: Math.max(1, Math.min(50, parseInt(e.target.value) || 1))
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              有効期限（時間）
            </label>
            <select
              value={createParams.expires_hours}
              onChange={(e) => setCreateParams(prev => ({ 
                ...prev, 
                expires_hours: parseInt(e.target.value) 
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>1時間</option>
              <option value={3}>3時間</option>
              <option value={6}>6時間</option>
              <option value={12}>12時間</option>
              <option value={24}>24時間</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={createCodes}
              disabled={creating}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {creating ? '発行中...' : 'コード発行'}
            </button>
          </div>
        </div>
      </div>

      {/* コード一覧 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">招待コード一覧</h2>
        
        {codes.length === 0 ? (
          <p className="text-gray-500 text-center py-8">招待コードがありません</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    コード
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状態
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    残り時間
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    発行日時
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    使用者
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    アクション
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {codes.map((code) => (
                  <tr key={code.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-lg font-bold">{code.code}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(code.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {code.status === 'active' ? formatRemainingTime(code.expires_at) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(code.issued_at).toLocaleString('ja-JP')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {code.used_by ? code.used_by.display_name || code.used_by.email : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      <button
                        onClick={() => copyToClipboard(code.code)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        コピー
                      </button>
                      {code.status === 'active' && (
                        <button
                          onClick={() => revokeCode(code.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          失効
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
