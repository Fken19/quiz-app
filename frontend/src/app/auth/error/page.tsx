'use client';

import { useSearchParams } from 'next/navigation';

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  let title = 'エラー';
  let message = '不明なエラーが発生しました。';
  let hint = '';

  if (error === 'AccessDenied') {
    title = 'アクセス拒否';
    message = 'このページへのアクセス権限がありません。';
    hint = '（管理者専用ページ、または生徒専用ページです）';
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md text-center">
        <h1 className="text-3xl font-bold text-red-600 mb-4">{title}</h1>
        <p className="text-lg text-gray-700 mb-2">{message}</p>
        {hint && <p className="text-sm text-gray-500 mb-4">{hint}</p>}
        <a href="/" className="mt-8 text-blue-600 underline">トップページへ戻る</a>
      </div>
    </div>
  );
}
