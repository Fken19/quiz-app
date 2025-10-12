import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export default async function TeacherIndexPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? '';

  if (role === 'teacher' || role === 'admin') {
    redirect('/teacher/dashboard');
  }

  redirect('/teacher/top');
}
