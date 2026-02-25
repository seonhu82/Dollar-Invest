import { NextResponse } from "next/server";
import { getExchangeRates, getExchangeRate, getRealtimeRates } from "@/lib/exchange";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const currency = searchParams.get("currency");
    const realtime = searchParams.get("realtime") === "true";

    if (currency) {
      const rate = await getExchangeRate(currency.toUpperCase());
      if (!rate) {
        return NextResponse.json(
          { error: "Currency not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(rate);
    }

    // realtime=true: 캐시 무시하고 최신 환율 직접 조회 (거래용)
    const rates = realtime ? await getRealtimeRates() : await getExchangeRates();
    return NextResponse.json({
      rates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("환율 조회 오류:", error);
    return NextResponse.json(
      { error: "환율 정보를 가져오는데 실패했습니다." },
      { status: 500 }
    );
  }
}
