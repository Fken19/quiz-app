import Link from 'next/link';

export const metadata = {
  title: '講師向けポータル | Quiz App',
};

export default function TeacherTopPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-white">
      <div className="mx-auto max-w-5xl px-6 py-16 space-y-20">
        <section className="space-y-6 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">For Teachers</p>
          <h1 className="text-4xl font-bold sm:text-5xl">講師向けダッシュボードで学習をフルサポート</h1>
          <p className="mx-auto max-w-3xl text-lg text-indigo-100">
            クラスや生徒の進捗をひと目で把握し、テスト配布・採点・フィードバックまで一貫して管理できます。
            Googleアカウントでログインすると、ホワイトリスト登録済みの講師はすぐにご利用いただけます。
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/teacher/login"
              className="inline-flex items-center justify-center rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400"
            >
              講師アカウントでログイン
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-indigo-300 px-6 py-3 text-sm font-semibold text-indigo-100 transition hover:bg-white/10"
            >
              生徒向けトップへ戻る
            </Link>
          </div>
        </section>

        <section className="grid gap-8 sm:grid-cols-2">
          {[{
            title: '進捗ダッシュボード',
            description: '提出状況や未提出者、締切間近のテストを自動で集計。次に対応すべきタスクがすぐに分かります。',
          }, {
            title: '名簿・グループ管理',
            description: 'フォルダ階層でクラスを整理し、生徒の移動や招待コード発行もワンクリックで完了。',
          }, {
            title: 'テスト作成と配布',
            description: '問題選択、配布、回収、採点をシームレスにつなぐワークフローで、業務の手間を最小化。',
          }, {
            title: '分析レポート',
            description: 'テスト結果や語彙の定着度を可視化し、次の授業や宿題の計画に役立てられます。',
          }].map((feature) => (
            <div key={feature.title} className="rounded-xl bg-white/5 p-6 shadow-lg backdrop-blur">
              <h2 className="text-xl font-semibold text-white">{feature.title}</h2>
              <p className="mt-3 text-sm text-indigo-100">{feature.description}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl bg-white/10 p-8 shadow-lg backdrop-blur">
          <h2 className="text-2xl font-semibold text-white">ホワイトリスト登録について</h2>
          <p className="mt-4 text-sm text-indigo-100">
            講師ポータルをご利用いただくには、事前に運営側でメールアドレスを登録する必要があります。
            新規利用をご希望の方は、サポート窓口までお問い合わせください。登録が完了すると、Googleログインだけでアクセス可能になります。
          </p>
        </section>
      </div>
    </div>
  );
}
