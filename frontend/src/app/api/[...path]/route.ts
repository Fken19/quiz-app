// Generic API proxy for all backend endpoints
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const INTERNAL_BASE =
  process.env.API_INTERNAL_BASE_URL ?? "http://backend:8080";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, await params, "GET");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, await params, "POST");
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, await params, "PUT");
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, await params, "PATCH");
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, await params, "DELETE");
}

async function proxyRequest(
  req: NextRequest,
  params: { path: string[] },
  method: string
) {
  try {
    const inUrl = new URL(req.url);
    const pathSegments = params.path || [];
    const joined = pathSegments.join("/");
    const firstSegment = pathSegments[0] || "";
    const routerEndpointsNeedingSlash = new Set([
      "users",
      "user-profiles",
      "teachers",
      "teacher-profiles",
      "teacher-whitelists",
      "invitation-codes",
      "student-teacher-links",
      "roster-folders",
      "roster-memberships",
      "vocabularies",
      "vocab-translations",
      "vocab-choices",
      "user-vocab-statuses",
      "learning-activity-logs",
      "learning-summary-daily",
      "quiz-collections",
      "quizzes",
      "quiz-questions",
      "quiz-results",
      "quiz-result-details",
      "tests",
      "test-questions",
      "test-assignments",
      "test-assignees",
      "test-results",
      "test-result-details",
    ]);

    let targetPath = `/api/${joined}`;
    if (routerEndpointsNeedingSlash.has(firstSegment) && !targetPath.endsWith("/")) {
      targetPath += "/";
    }

    const target = new URL(targetPath, INTERNAL_BASE);
    target.search = inUrl.search;

    // Copy headers
    const headers = new Headers();
    const auth = req.headers.get("authorization");
    if (auth) headers.set("authorization", auth);
    const cookie = req.headers.get("cookie");
    if (cookie) headers.set("cookie", cookie);
    headers.set("accept", "application/json");

    const contentType = req.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);

    // Get body for POST/PUT/PATCH
    let body: BodyInit | null = null;
    if (["POST", "PUT", "PATCH"].includes(method)) {
      const rawBody = await req.arrayBuffer();
      if (rawBody.byteLength > 0) {
        body = rawBody;
      }
    }

    const res = await fetch(target.toString(), {
      method,
      headers,
      body,
      cache: "no-store",
    });

    const responseBody = await res.arrayBuffer();
    const outHeaders = new Headers(res.headers);
    outHeaders.delete("content-encoding");

    return new NextResponse(responseBody, {
      status: res.status,
      headers: outHeaders,
    });
  } catch (error) {
    console.error(`[/api/${params.path?.join("/") || ""}] Proxy error:`, error);
    return NextResponse.json(
      { error: "Proxy request failed", details: String(error) },
      { status: 500 }
    );
  }
}
