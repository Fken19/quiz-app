export default function AccessDeniedPage() {
  return (
    <div className="max-w-xl mx-auto mt-20 bg-white shadow rounded-lg p-8 space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">アクセスが許可されていません</h1>
      <p className="text-slate-600">
        この講師向けポータルを利用するには、事前にホワイトリスト登録が必要です。管理者にお問い合わせください。
      </p>
    </div>
  );
}
