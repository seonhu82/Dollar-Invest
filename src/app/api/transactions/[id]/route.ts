import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE: 거래 삭제
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    // 거래 소유권 확인
    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        portfolio: true,
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "거래를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 수동 입력만 삭제 가능
    if (!transaction.isManual) {
      return NextResponse.json(
        { error: "자동 동기화된 거래는 삭제할 수 없습니다." },
        { status: 400 }
      );
    }

    // 트랜잭션 실행 - 거래 삭제 + 포트폴리오 업데이트
    await prisma.$transaction(async (tx) => {
      // 거래 삭제
      await tx.transaction.delete({
        where: { id },
      });

      // 포트폴리오 재계산 (해당 포트폴리오의 모든 거래 기반)
      const allTransactions = await tx.transaction.findMany({
        where: { portfolioId: transaction.portfolioId },
        orderBy: { tradedAt: "asc" },
      });

      let balance = 0;
      let totalCost = 0;
      let totalInvested = 0;

      for (const t of allTransactions) {
        const amount = Number(t.amount);
        const rate = Number(t.rate);
        const krwAmount = Number(t.krwAmount);

        if (t.type === "BUY") {
          totalCost += amount * rate;
          balance += amount;
          totalInvested += krwAmount;
        } else {
          const avgRate = balance > 0 ? totalCost / balance : 0;
          totalCost -= amount * avgRate;
          balance -= amount;
          totalInvested = balance > 0
            ? totalInvested * (balance / (balance + amount))
            : 0;
        }
      }

      const avgBuyRate = balance > 0 ? totalCost / balance : 0;

      await tx.portfolio.update({
        where: { id: transaction.portfolioId },
        data: {
          currentBalance: balance,
          avgBuyRate,
          totalInvested,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("거래 삭제 오류:", error);
    return NextResponse.json(
      { error: "거래 삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}
