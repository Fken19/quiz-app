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
    
    // バックエンドAPIに転送（Docker環境では backend:8080 を使用）
    const backendUrl = `http://backend:8080/api/quiz/history${queryString ? `?${queryString}` : ''}`;
    
    console.log('Proxying to:', backendUrl); // デバッグ用
    
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Authorization': bearerToken,
        'Content-Type': 'application/json',
      },
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
