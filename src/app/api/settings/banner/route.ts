import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/settings/banner
 * 배너 설정만 경량 조회 (비로그인 시 기본값 반환)
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({
        bannerEnabled: true,
        bannerCurrencies: "USD,JPY,EUR,GBP,CNY",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        bannerEnabled: true,
        bannerCurrencies: true,
      },
    });

    return NextResponse.json({
      bannerEnabled: user?.bannerEnabled ?? true,
      bannerCurrencies: user?.bannerCurrencies ?? "USD,JPY,EUR,GBP,CNY",
    });
  } catch {
    return NextResponse.json({
      bannerEnabled: true,
      bannerCurrencies: "USD,JPY,EUR,GBP,CNY",
    });
  }
}
