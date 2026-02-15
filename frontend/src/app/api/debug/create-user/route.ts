import { NextRequest, NextResponse } from "next/server";

const INTERNAL_BASE =
  process.env.API_INTERNAL_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://backend:8080";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    const upstream = await fetch(`${INTERNAL_BASE}/api/debug/create-user/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const bodyText = await upstream.text();
    return new NextResponse(bodyText, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    console.error("[debug/create-user] Error:", error);
    return NextResponse.json(
      { error: "Failed to create user", details: String(error) },
      { status: 500 }
    );
  }
}
