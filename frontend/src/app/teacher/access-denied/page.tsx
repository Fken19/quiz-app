'use client';

import { useRouter } from 'next/navigation';
import { ExclamationTriangleIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function AccessDeniedPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-8 space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="rounded-full bg-amber-100 p-4">
            <ExclamationTriangleIcon className="h-12 w-12 text-amber-600" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">
            ホワイトリストに登録されていません
          </h1>
          <p className="text-slate-600 leading-relaxed">
            お使いのメールアドレスは講師用ホワイトリストに登録されていません。
          </p>
        </div>

        {/* Message */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
          <p className="text-sm text-amber-900 font-medium">
            📧 ホワイトリスト登録について
          </p>
          <p className="text-sm text-amber-800">
            講師ポータルをご利用いただくには、管理者によるホワイトリスト登録が必要です。
            システム管理者にお問い合わせください。
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={() => router.push('/')}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors shadow-lg font-medium"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            トップページに戻る
          </button>
          
          <button
            onClick={() => router.push('/auth/signout')}
            className="w-full bg-slate-100 text-slate-700 px-6 py-3 rounded-lg hover:bg-slate-200 transition-colors font-medium"
          >
            ログアウト
          </button>
        </div>

        {/* Footer Note */}
        <p className="text-xs text-center text-slate-500">
          別のアカウントでログインする場合は、一度ログアウトしてください
        </p>
      </div>
    </div>
  );
}
