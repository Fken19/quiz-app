'use client';

import { ShieldCheckIcon, LockClosedIcon } from '@heroicons/react/24/outline';

export default function WhitelistManagementPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-8 text-white">
          <div className="flex items-center gap-3">
            <ShieldCheckIcon className="h-8 w-8" />
            <h1 className="text-3xl font-bold">ホワイトリスト管理</h1>
          </div>
          <p className="mt-2 text-indigo-100">
            講師アクセス権限を持つメールアドレスの管理
          </p>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="flex flex-col items-center justify-center text-center space-y-6 py-12">
            {/* Icon */}
            <div className="rounded-full bg-slate-100 p-6">
              <LockClosedIcon className="h-16 w-16 text-slate-400" />
            </div>

            {/* Message */}
            <div className="space-y-3 max-w-md">
              <h2 className="text-xl font-semibold text-slate-900">
                管理者専用機能
              </h2>
              <p className="text-slate-600 leading-relaxed">
                ホワイトリストの管理は、セキュリティ上の理由からシステム管理者のみが行えます。
              </p>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-lg space-y-3">
              <p className="text-sm font-medium text-blue-900">
                📋 ホワイトリストの管理方法
              </p>
              <ol className="text-sm text-blue-800 space-y-2 text-left list-decimal list-inside">
                <li>Django管理画面にアクセス</li>
                <li>「Teacher whitelists」セクションを選択</li>
                <li>メールアドレスを追加・編集・削除</li>
              </ol>
              <div className="mt-4 pt-4 border-t border-blue-200">
                <p className="text-xs text-blue-700">
                  <strong>Django管理画面URL:</strong><br />
                  <code className="bg-blue-100 px-2 py-1 rounded">/admin/</code>
                </p>
              </div>
            </div>

            {/* Note */}
            <p className="text-sm text-slate-500 max-w-md">
              新しい講師を追加する場合や、既存の講師の権限を変更する場合は、
              システム管理者にご連絡ください。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
