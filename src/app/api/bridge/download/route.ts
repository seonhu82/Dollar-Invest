import { NextResponse } from "next/server";

// PC 브릿지 정보
const BRIDGE_INFO = {
  version: "1.0.0",
  releaseDate: "2026-02-08",
  fileName: "dollar-invest-bridge-setup.exe",
  fileSize: "15.2 MB",
  requirements: {
    os: "Windows 10 이상",
    runtime: ".NET Framework 4.8",
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
    downloadUrl: "/api/bridge/download",
  });
}

// POST: 브릿지 다운로드
export async function POST() {
  // 실제 구현에서는 S3나 파일 서버에서 바이너리를 스트리밍
  // 현재는 데모용으로 안내 텍스트 파일 제공

  const readmeContent = `
========================================
달러인베스트 PC 브릿지 v${BRIDGE_INFO.version}
========================================

이 파일은 데모 버전입니다.
실제 브릿지 프로그램은 별도로 개발되어야 합니다.

[시스템 요구사항]
- ${BRIDGE_INFO.requirements.os}
- ${BRIDGE_INFO.requirements.runtime}
- ${BRIDGE_INFO.requirements.broker} 설치

[설치 방법]
1. 하나증권 1Q Open API를 먼저 설치합니다.
2. dollar-invest-bridge-setup.exe를 실행합니다.
3. 설치 마법사를 따라 설치를 완료합니다.
4. 시작 메뉴에서 "달러인베스트 브릿지"를 실행합니다.

[사용 방법]
1. 브릿지 프로그램을 실행합니다.
2. 하나증권 로그인 버튼을 클릭합니다.
3. 공동인증서로 로그인합니다.
4. 웹사이트에서 연결 상태를 확인합니다.

[기술 지원]
- 문의: support@dollar-invest.com
- GitHub: https://github.com/dollar-invest/bridge

========================================
`;

  return new NextResponse(readmeContent, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="dollar-invest-bridge-readme.txt"`,
    },
  });
}
