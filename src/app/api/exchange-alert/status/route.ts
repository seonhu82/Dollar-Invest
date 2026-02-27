import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeStatus, CURRENCY_CONFIGS } from "@/lib/exchange-alert-engine";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

/**
 * GET /api/exchange-alert/status
 *
 * 배너용 간략 분석 데이터.
 * 로그인 시: 사용자 포트폴리오의 관리 통화 분석
 * 비로그인 시: USD, EUR, JPY 기본 분석
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const currenciesParam = searchParams.get("currencies");

    let currencies: string[] = ["USD", "JPY", "EUR", "GBP", "CNY"];

    if (currenciesParam) {
      // 명시적으로 통화 지정 시 해당 통화만 분석
      currencies = currenciesParam.split(",").filter((c) => CURRENCY_CONFIGS[c]);
    } else {
      // 로그인 사용자의 포트폴리오 통화 확인
      try {
        const session = await auth();
        if (session?.user?.id) {
          const portfolios = await prisma.portfolio.findMany({
            where: { userId: session.user.id },
            select: { currency: true },
            distinct: ["currency"],
          });

          if (portfolios.length > 0) {
            currencies = portfolios
              .map((p) => p.currency)
              .filter((c) => CURRENCY_CONFIGS[c]);
          }
        }
      } catch {
        // 인증 실패 시 기본 통화 사용
      }
    }

    const alerts = await analyzeStatus(currencies);

    return NextResponse.json({
      alerts,
      currencies,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Exchange alert status error:", error);
    return NextResponse.json(
      { error: "환율 알림 조회에 실패했습니다.", alerts: [] },
      { status: 500 }
    );
  }
}
