// frontend/src/app/api/tests/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const INTERNAL_BASE =
  process.env.API_INTERNAL_BASE_URL ?? "http://backend:8080";

export async function GET(req: NextRequest) {
  // /api/tests/?page_size=10 を backend の /api/tests/?page_size=10 へ
  const inUrl = new URL(req.url);
  const target = new URL("/api/tests/", INTERNAL_BASE);
  target.search = inUrl.search;

  // Authorization ヘッダを引き継ぐ（Bearer token）
  const headers = new Headers();
  const auth = req.headers.get("authorization");
  if (auth) headers.set("authorization", auth);

  // JSON想定
  headers.set("accept", "application/json");

  try {
    const res = await fetch(target.toString(), {
      method: "GET",
      headers,
      cache: "no-store",
    });

    const body = await res.arrayBuffer();
    const outHeaders = new Headers(res.headers);
    outHeaders.delete("content-encoding"); // 念のため

    return new NextResponse(body, {
      status: res.status,
      headers: outHeaders,
    });
  } catch (error) {
    console.error("[/api/tests] Proxy error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tests", details: String(error) },
      { status: 500 }
    );
  }
}
