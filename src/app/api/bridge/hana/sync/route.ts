import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncHanaTransactions, getHanaBalance, getBridgeStatus } from "@/lib/bridge";

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { brokerAccountId, startDate, endDate } = body;

    // 브릿지 상태 확인
    const status = await getBridgeStatus();
    if (!status.connected || !status.hana_connected) {
      return NextResponse.json(
        { error: "하나증권에 연결되어 있지 않습니다." },
        { status: 503 }
      );
    }

    // 브로커 계정 확인
    const brokerAccount = await prisma.brokerAccount.findFirst({
      where: {
        id: brokerAccountId,
        userId: session.user.id,
        broker: "HANA",
      },
      include: {
        portfolios: true,
      },
    });

    if (!brokerAccount) {
      return NextResponse.json(
        { error: "연동된 하나증권 계정을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 거래 내역 동기화
    const txResult = await syncHanaTransactions({ startDate, endDate });

    if (!txResult.success) {
      return NextResponse.json(
        { error: txResult.error || "거래 내역 동기화에 실패했습니다." },
        { status: 400 }
      );
    }

    // 포트폴리오 찾기 (USD 기준)
    let portfolio = brokerAccount.portfolios.find((p) => p.currency === "USD");
    if (!portfolio) {
      portfolio = await prisma.portfolio.create({
        data: {
          userId: session.user.id,
          brokerAccountId: brokerAccount.id,
          name: "하나증권 달러",
          currency: "USD",
        },
      });
    }

    // 거래 내역 저장
    let syncedCount = 0;
    const transactions = txResult.transactions || [];

    for (const tx of transactions) {
      // 중복 체크
      const existing = await prisma.transaction.findFirst({
        where: {
          orderId: tx.orderId,
          brokerAccountId: brokerAccount.id,
        },
      });

      if (!existing) {
        await prisma.transaction.create({
          data: {
            userId: session.user.id,
            portfolioId: portfolio.id,
            brokerAccountId: brokerAccount.id,
            type: tx.type,
            currency: tx.currency,
            amount: tx.amount,
            rate: tx.rate,
            krwAmount: tx.krwAmount,
            fee: tx.fee,
            tradedAt: new Date(tx.tradedAt),
            orderId: tx.orderId,
            orderStatus: "COMPLETED",
            isManual: false,
            syncedAt: new Date(),
          },
        });
        syncedCount++;
      }
    }

    // 잔고 동기화
    const balanceResult = await getHanaBalance();
    if (balanceResult.success && balanceResult.balances) {
      const usdBalance = balanceResult.balances.find((b) => b.currency === "USD");
      if (usdBalance) {
        await prisma.portfolio.update({
          where: { id: portfolio.id },
          data: {
            currentBalance: usdBalance.balance,
            avgBuyRate: usdBalance.avgBuyRate,
            totalInvested: usdBalance.balance * usdBalance.avgBuyRate,
          },
        });
      }
    }

    // 마지막 동기화 시간 업데이트
    await prisma.brokerAccount.update({
      where: { id: brokerAccount.id },
      data: { lastSyncAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: `${syncedCount}건의 거래가 동기화되었습니다.`,
      syncedCount,
      totalTransactions: transactions.length,
    });
  } catch (error) {
    console.error("동기화 오류:", error);
    return NextResponse.json(
      { error: "동기화 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
