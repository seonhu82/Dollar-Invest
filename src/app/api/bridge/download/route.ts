import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

// PC 브릿지 정보
const BRIDGE_INFO = {
  version: "1.0.0",
  releaseDate: "2026-02-08",
  fileName: "dollar-invest-bridge.zip",
  fileSize: "~10 KB",
  requirements: {
    os: "Windows 10 이상",
    runtime: "Python 3.8+",
    broker: "하나증권 1Q Open API",
  },
  changelog: [
    "v1.0.0 - 초기 릴리즈",
    "- 하나증권 1Q Open API 연동",
    "- 실시간 잔고 조회",
    "- 매수/매도 주문",
    "- 거래내역 동기화",
  ],
};

// GET: 브릿지 정보 조회
export async function GET() {
  return NextResponse.json({
    available: true,
    info: BRIDGE_INFO,
    downloadUrl: "/dollar-invest-bridge.zip",
  });
}

// POST: 브릿지 다운로드
export async function POST() {
  try {
    const filePath = path.join(process.cwd(), "public", "dollar-invest-bridge.zip");
    const fileBuffer = await readFile(filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="dollar-invest-bridge.zip"`,
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("브릿지 다운로드 오류:", error);
    return NextResponse.json(
      { error: "파일을 찾을 수 없습니다." },
      { status: 404 }
    );
  }
}
