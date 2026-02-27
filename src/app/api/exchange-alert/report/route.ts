import { NextResponse } from "next/server";
import { analyzeReport, CURRENCY_CONFIGS } from "@/lib/exchange-alert-engine";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

/**
 * GET /api/exchange-alert/report?currency=USD
 *
 * 상세 리포트 다이얼로그용 전체 분석 데이터.
 * 최근 20일 캔들 + 지표값 + 요약 통계 포함.
 * 다이얼로그 열 때만 호출 (서버 부하 최소화).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const currency = searchParams.get("currency")?.toUpperCase() || "USD";

    if (!CURRENCY_CONFIGS[currency]) {
      return NextResponse.json(
        { error: `지원하지 않는 통화입니다: ${currency}` },
        { status: 400 }
      );
    }

    const report = await analyzeReport(currency);

    if (!report) {
      return NextResponse.json(
        { error: "분석 데이터가 부족합니다. 잠시 후 다시 시도해주세요." },
        { status: 503 }
      );
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error("Exchange alert report error:", error);
    return NextResponse.json(
      { error: "상세 분석 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}
