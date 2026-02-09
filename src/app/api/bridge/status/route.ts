import { NextResponse } from "next/server";

const BRIDGE_URL = process.env.BRIDGE_URL || "http://127.0.0.1:8585";

export async function GET() {
  try {
    const response = await fetch(`${BRIDGE_URL}/status`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      throw new Error("Bridge not responding");
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      {
        connected: false,
        hanaConnected: false,
        version: null,
        last_sync: null,
        error: "브릿지에 연결할 수 없습니다",
      },
      { status: 503 }
    );
  }
}
