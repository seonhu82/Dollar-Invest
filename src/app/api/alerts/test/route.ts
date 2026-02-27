import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getExchangeRates } from "@/lib/exchange";
import { analyzeStatus } from "@/lib/exchange-alert-engine";

export const dynamic = "force-dynamic";

/**
 * POST /api/alerts/test
 * 테스트 알림 로그 생성 (현재 환율 기반 분석 리포트)
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const currencies = ["USD", "JPY", "EUR", "GBP", "CNY"];
    const [rates, alerts] = await Promise.all([
      getExchangeRates(),
      analyzeStatus(currencies),
    ]);

    const logs = [];

    for (const alert of alerts) {
      const rate = rates.find((r) => r.currency === alert.currency);
      if (!rate) continue;

      const log = await prisma.alertLog.create({
        data: {
          userId: session.user.id,
          type: "EXCHANGE_ALERT",
          title: `${alert.currencyName} ${alert.tierLabel} (${alert.score > 0 ? "+" : ""}${alert.score}점)`,
          message: `${alert.currency}/KRW 현재 ${rate.rate.toLocaleString()}원 | CCI: ${alert.cci} | RSI: ${alert.rsi} | BB%B: ${(alert.bbPercent * 100).toFixed(1)}%`,
          rate: rate.rate,
        },
      });

      logs.push({
        id: log.id,
        type: log.type,
        title: log.title,
        message: log.message,
        rate: Number(log.rate),
        createdAt: log.createdAt,
      });
    }

    return NextResponse.json({
      success: true,
      message: `${logs.length}개 알림 리포트가 생성되었습니다.`,
      logs,
    });
  } catch (error) {
    console.error("테스트 알림 생성 오류:", error);
    return NextResponse.json(
      { error: "테스트 알림 생성에 실패했습니다." },
      { status: 500 }
    );
  }
}
