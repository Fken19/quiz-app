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

    // Authorization ヘッダーの変換（Token → Bearer）
    let bearerToken = authHeader;
    if (authHeader.startsWith('Token ')) {
      const token = authHeader.replace('Token ', '');
      bearerToken = `Bearer ${token}`;
    }

    // バックエンドのベースURLを環境変数から取得
    const backendBase = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL_BROWSER || 'http://localhost:8080';
    const backendBaseNormalized = backendBase.replace(/\/$/, '');
    const backendUrl = `${backendBaseNormalized}/api/user/profile/`;

    console.log('Profile GET - Proxying to:', backendUrl);

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Authorization': bearerToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend profile GET error:', response.status, errorText);
      return NextResponse.json(
        { error: `Backend error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Profile GET API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    // Authorization ヘッダーの変換（Token → Bearer）
    let bearerToken = authHeader;
    if (authHeader.startsWith('Token ')) {
      const token = authHeader.replace('Token ', '');
      bearerToken = `Bearer ${token}`;
    }

    // バックエンドのベースURLを環境変数から取得
    const backendBase = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL_BROWSER || 'http://localhost:8080';
    const backendBaseNormalized = backendBase.replace(/\/$/, '');
    const backendUrl = `${backendBaseNormalized}/api/user/profile/`;

    console.log('Profile POST - Proxying to:', backendUrl);

    // FormData をそのまま転送
    const formData = await request.formData();

    const response = await fetch(backendUrl, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': bearerToken,
        // FormData の場合、Content-Type は自動設定されるため明示的に設定しない
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend profile POST error:', response.status, errorText);
      return NextResponse.json(
        { error: `Backend error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Profile POST API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
