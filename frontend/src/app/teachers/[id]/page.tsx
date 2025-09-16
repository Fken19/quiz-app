"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import Link from 'next/link';
import { apiGet } from '@/lib/api-utils';
import { normalizeAvatarUrl } from '@/lib/avatar';

interface PublicUserProfile {
	id: string;
	display_name: string;
	avatar_url?: string | null;
	avatar?: string | null;
	organization?: string | null;
	bio?: string | null;
}

export default function TeacherProfilePage() {
	const params = useParams();
	const teacherId = params?.id as string;
	const { data: session, status } = useSession();
	const [teacher, setTeacher] = useState<PublicUserProfile | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (status === 'unauthenticated') {
			signIn('google');
			return;
		}
		if (status === 'authenticated' && teacherId) {
			fetchTeacher();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [status, teacherId]);

	const fetchTeacher = async () => {
		setLoading(true);
		setError(null);
		try {
			// 既存APIには教師の公開プロフィール専用のエンドポイントがないため、
			// 自分と紐付いた講師一覧から該当IDを探す形で取得（/student/teachers/）
			const links = await apiGet('/student/teachers/');
			const list = Array.isArray(links) ? links : links?.results ?? [];
			const found = list.find((l: any) => String(l.teacher?.id) === String(teacherId));
			if (!found) {
				throw new Error('この講師のプロフィールは閲覧できません');
			}
			const t = found.teacher || {};
			const avatar = normalizeAvatarUrl(t.avatar_url || t.avatar);
			setTeacher({
				id: String(t.id),
				display_name: t.display_name || '講師',
				avatar_url: (avatar as string) || null,
				organization: t.organization || null,
				bio: t.bio || null,
			});
		} catch (e: any) {
			console.error('教師プロフィール取得エラー', e);
			setError(e?.message || 'プロフィール取得に失敗しました');
		} finally {
			setLoading(false);
		}
	};

	if (status === 'loading' || loading) {
		return (
			<div className="max-w-3xl mx-auto px-4 py-10">
				<div className="text-center text-black">読み込み中...</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="max-w-3xl mx-auto px-4 py-10">
				<div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded">{error}</div>
				<div className="mt-6 text-center">
					<Link href="/profile" className="text-blue-600 hover:underline">プロフィールに戻る</Link>
				</div>
			</div>
		);
	}

	if (!teacher) return null;

	return (
		<div className="max-w-3xl mx-auto px-4 py-10">
			<div className="flex items-center gap-4 mb-6">
				{teacher.avatar_url ? (
					<img src={teacher.avatar_url} alt="講師アバター" className="w-16 h-16 rounded-full object-cover border" />
				) : (
					<div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-2xl font-semibold">
						{(teacher.display_name?.[0] || 'T').toUpperCase()}
					</div>
				)}
				<div>
					<h1 className="text-2xl font-bold text-black">{teacher.display_name}</h1>
					{teacher.organization && (
						<p className="text-sm text-black mt-1">{teacher.organization}</p>
					)}
				</div>
			</div>

			<div className="bg-white rounded-lg shadow p-6">
				<h2 className="text-lg font-semibold text-black mb-3">講師プロフィール</h2>
				{teacher.bio ? (
					<p className="text-black whitespace-pre-wrap">{teacher.bio}</p>
				) : (
					<p className="text-black">自己紹介は未設定です。</p>
				)}
				<div className="mt-6 text-sm text-black">
					{/* メールは表示しない（相互非表示要件） */}
					<p>メールアドレスは非公開です</p>
				</div>
			</div>

			<div className="mt-6 text-center">
				<Link href="/profile" className="text-blue-600 hover:underline">プロフィールに戻る</Link>
			</div>
		</div>
	);
}

