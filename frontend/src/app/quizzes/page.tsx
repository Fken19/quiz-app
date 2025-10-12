import { redirect } from 'next/navigation';

export default function QuizzesLegacyRedirect() {
  redirect('/student/quiz');
}
