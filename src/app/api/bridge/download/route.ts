import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

// PC 브릿지 정보
const BRIDGE_INFO = {
  version: "1.0.0",
  releaseDate: "2026-02-09",
  fileName: "DollarInvestBridge.exe",
  fileSize: "~55 MB",
  requirements: {
    os: "Windows 10 이상",
    runtime: "설치 불필요 (단일 실행파일)",
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
    downloadUrl: "/DollarInvestBridge.exe",
  });
}

// POST: 브릿지 다운로드
export async function POST() {
  try {
    const filePath = path.join(process.cwd(), "public", "DollarInvestBridge.exe");
    const fileBuffer = await readFile(filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="DollarInvestBridge.exe"`,
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
