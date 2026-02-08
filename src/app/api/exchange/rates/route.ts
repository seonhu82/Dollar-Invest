import { NextResponse } from "next/server";
import { getExchangeRates, getExchangeRate } from "@/lib/exchange";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const currency = searchParams.get("currency");

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

    const rates = await getExchangeRates();
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
