type Props = {
  userId?: string | null;
  provider?: string | null;
  roleLabel: string;
  createdAt?: string | null;
};

export function TeacherAccountCard({ userId, provider, roleLabel, createdAt }: Props) {
  return (
    <section className="mt-8 rounded-2xl bg-white px-6 py-5 shadow-md shadow-slate-200 md:px-8 md:py-6">
      <h2 className="text-base font-semibold text-slate-900">アカウント情報</h2>

      <div className="mt-4 grid gap-4 text-sm text-slate-700 md:grid-cols-2">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
            ユーザーID
          </div>
          <div className="mt-0.5 break-all font-mono text-xs text-slate-900">{userId || "-"}</div>
        </div>

        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
            認証プロバイダー
          </div>
          <div className="mt-0.5">{provider || "-"}</div>
        </div>

        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
            権限
          </div>
          <div className="mt-1">
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
              {roleLabel}
            </span>
          </div>
        </div>

        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
            登録日
          </div>
          <div className="mt-0.5">{createdAt || "-"}</div>
        </div>
      </div>
    </section>
  );
}

export default TeacherAccountCard;
