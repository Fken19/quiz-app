import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'トークンがありません' }, { status: 400 });
    }

    // Django APIに直接テスト
    const response = await fetch('http://backend:8080/api/quiz-sets/', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    return NextResponse.json({
      status: response.status,
      statusText: response.statusText,
      data: data,
    });

  } catch (error) {
    return NextResponse.json(
      { error: `テストエラー: ${error}` },
      { status: 500 }
    );
  }
}
