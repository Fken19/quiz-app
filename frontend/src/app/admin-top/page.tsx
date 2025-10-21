import { redirect } from 'next/navigation';

export const metadata = {
  title: '講師向けダッシュボード | Quiz App',
  description: '講師ポータルのトップページへリダイレクトしています。',
};

export default function AdminTopPage() {
  redirect('/teacher/top');
}
