import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadKISCredentials, getKISBalance } from "@/lib/kis";

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const { brokerAccountId } = body;

    if (!brokerAccountId) {
      return NextResponse.json({ error: "계정 ID가 필요합니다." }, { status: 400 });
    }

    // 계정 소유권 확인
    const account = await prisma.brokerAccount.findFirst({
      where: {
        id: brokerAccountId,
        userId: session.user.id,
        broker: "KIS",
      },
    });

    if (!account) {
      return NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 });
    }

    // 자격 증명 로드
    const credentials = await loadKISCredentials(brokerAccountId);

    if (!credentials) {
      return NextResponse.json(
        { error: "자격 증명을 찾을 수 없습니다. 다시 연동해주세요." },
        { status: 400 }
      );
    }

    // 잔고 조회
    const balance = await getKISBalance(credentials);

    if (!balance) {
      return NextResponse.json(
        { error: "잔고 조회에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      balance: {
        currency: balance.currency,
        balance: balance.balance,
        availableBalance: balance.availableBalance,
        totalValue: balance.totalValue,
        profitLoss: balance.profitLoss,
        profitLossPercent: balance.profitLossPercent,
      },
    });
  } catch (error) {
    console.error("KIS 잔고 조회 오류:", error);
    return NextResponse.json(
      { error: "잔고 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}
