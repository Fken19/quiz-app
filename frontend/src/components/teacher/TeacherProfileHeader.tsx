type Props = {
  avatarUrl?: string | null;
  displayName: string;
  affiliation?: string | null;
  email: string;
  updatedAtLabel: string;
  selfIntro?: string | null;
};

export function TeacherProfileHeader({
  avatarUrl,
  displayName,
  affiliation,
  email,
  updatedAtLabel,
  selfIntro,
}: Props) {
  const hasAvatar = Boolean(avatarUrl);

  return (
    <section className="overflow-hidden rounded-3xl bg-white shadow-lg shadow-slate-200">
      <div className="h-32 bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400" />
      <div className="px-6 pb-6 pt-0 md:px-8 md:pb-8">
        <div className="-mt-16 flex items-end gap-4">
          <div className="h-28 w-28 shrink-0 rounded-full border-4 border-white bg-white shadow-md md:h-32 md:w-32">
            {hasAvatar && avatarUrl ? (
              // 生徒側と同様、通常の img で表示（next/image だとリサイズされるため）
              <img
                src={avatarUrl}
                alt="プロフィール画像"
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-400">
                画像未設定
              </div>
            )}
          </div>
          <div className="pb-2">
            <div className="text-xl font-semibold text-slate-900 md:text-2xl">
              {displayName || "未設定"}
            </div>
            {affiliation && (
              <div className="mt-1 text-sm text-slate-600">{affiliation}</div>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-4 text-sm text-slate-700 md:grid-cols-2">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
              メールアドレス
            </div>
            <div className="mt-0.5 break-all">{email || "-"}</div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
              表示名
            </div>
            <div className="mt-0.5">{displayName || "未設定"}</div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
              更新日
            </div>
            <div className="mt-0.5">{updatedAtLabel || "-"}</div>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
            自己紹介
          </div>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">
            {selfIntro && selfIntro.trim().length > 0
              ? selfIntro
              : "自己紹介はまだ入力されていません。"}
          </p>
        </div>
      </div>
    </section>
  );
}

export default TeacherProfileHeader;
