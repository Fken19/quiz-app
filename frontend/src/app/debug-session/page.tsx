'use client';

import { useSession } from 'next-auth/react';
import { useState } from 'react';

export default function DebugSessionPage() {
  const { data: session, status } = useSession();
  const [testResult, setTestResult] = useState<string>('');

  const testGoogleAuth = async () => {
    try {
      if (!session || !(session as any).backendAccessToken) {
        setTestResult('セッションまたはトークンがありません');
        return;
      }

      const response = await fetch('/api/test-backend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: (session as any).backendAccessToken
        })
      });

      const result = await response.text();
      setTestResult(`Response: ${response.status} - ${result}`);
    } catch (error) {
      setTestResult(`Error: ${error}`);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">セッション・認証デバッグ</h1>
      
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">セッション状態</h2>
        <p>Status: {status}</p>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">セッション詳細</h2>
        <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
          {JSON.stringify(session, null, 2)}
        </pre>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">バックエンドトークン</h2>
        <p>Token: {(session as any)?.backendAccessToken || '取得されていません'}</p>
      </div>

      <div className="mb-6">
        <button
          onClick={testGoogleAuth}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          バックエンド認証テスト
        </button>
        {testResult && (
          <div className="mt-2">
            <pre className="bg-gray-100 p-2 rounded text-sm">
              {testResult}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
