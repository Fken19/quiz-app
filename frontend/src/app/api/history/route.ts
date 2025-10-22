import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    // Tokenヘッダーを想定し、BearerヘッダーにTransform
    let bearerToken = authHeader;
    if (authHeader.startsWith('Token ')) {
      const token = authHeader.replace('Token ', '');
      bearerToken = `Bearer ${token}`;
    }

    // URLSearchParamsを取得
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    
    // バックエンドのベースURLは環境変数で切り替え可能にする
    // 優先順: BACKEND_URL (server-only) -> NEXT_PUBLIC_API_URL_BROWSER -> ローカルデフォルト
  // サーバー側では明示的な BACKEND_URL または NEXT_PUBLIC_API_URL を優先して使う。
  // ブラウザ向けの NEXT_PUBLIC_API_URL_BROWSER は最後のフォールバックにする。
  const backendBase = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL_BROWSER || 'http://localhost:8080';
    const backendBaseNormalized = backendBase.replace(/\/$/, '');
    const backendUrl = `${backendBaseNormalized}/api/quiz/history${queryString ? `?${queryString}` : ''}`;

    console.log('Proxying to:', backendUrl); // デバッグ用

    // Authorization ヘッダーは Token または Bearer を受け取り、そのままバックエンドに渡す
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (bearerToken) headers['Authorization'] = bearerToken;

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers,
      // タイムアウトやネットワークエラーが起きやすいので必要に応じて fetch polyfill でタイムアウトを入れる
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', response.status, errorText);
      return NextResponse.json(
        { error: `Backend error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('History API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
