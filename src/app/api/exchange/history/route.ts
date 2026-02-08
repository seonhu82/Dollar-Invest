import { NextResponse } from "next/server";
import { getExchangeRateHistory } from "@/lib/exchange";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const currency = searchParams.get("currency") || "USD";
    const days = parseInt(searchParams.get("days") || "30", 10);

    const history = await getExchangeRateHistory(currency.toUpperCase(), days);

    return NextResponse.json({
      currency,
      history,
      days,
    });
  } catch (error) {
    console.error("환율 히스토리 조회 오류:", error);
    return NextResponse.json(
      { error: "환율 히스토리를 가져오는데 실패했습니다." },
      { status: 500 }
    );
  }
}
