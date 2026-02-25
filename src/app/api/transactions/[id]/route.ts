import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// 포트폴리오 재계산 헬퍼
async function recalculatePortfolio(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], portfolioId: string) {
  const allTransactions = await tx.transaction.findMany({
    where: { portfolioId },
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
    where: { id: portfolioId },
    data: {
      currentBalance: balance,
      avgBuyRate,
      totalInvested,
    },
  });
}

// PATCH: 거래 수정 (환율, 금액, 수수료, 메모)
const updateTransactionSchema = z.object({
  rate: z.number().positive("환율은 0보다 커야 합니다").optional(),
  amount: z.number().positive("금액은 0보다 커야 합니다").optional(),
  fee: z.number().min(0).optional(),
  memo: z.string().max(200).optional().nullable(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const validation = updateTransactionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const updates = validation.data;

    // 거래 소유권 확인
    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "거래를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (!transaction.isManual) {
      return NextResponse.json(
        { error: "자동 동기화된 거래는 수정할 수 없습니다." },
        { status: 400 }
      );
    }

    // 트랜잭션 실행 - 거래 수정 + 포트폴리오 재계산
    const result = await prisma.$transaction(async (tx) => {
      const newRate = updates.rate ?? Number(transaction.rate);
      const newAmount = updates.amount ?? Number(transaction.amount);
      const newFee = updates.fee ?? Number(transaction.fee);
      const newKrwAmount = newAmount * newRate + newFee;

      const updated = await tx.transaction.update({
        where: { id },
        data: {
          ...(updates.rate !== undefined && { rate: updates.rate }),
          ...(updates.amount !== undefined && { amount: updates.amount }),
          ...(updates.fee !== undefined && { fee: updates.fee }),
          ...(updates.memo !== undefined && { memo: updates.memo }),
          krwAmount: newKrwAmount,
        },
      });

      // 포트폴리오 재계산
      await recalculatePortfolio(tx, transaction.portfolioId);

      return updated;
    });

    return NextResponse.json({
      transaction: {
        id: result.id,
        type: result.type,
        amount: Number(result.amount),
        rate: Number(result.rate),
        krwAmount: Number(result.krwAmount),
        fee: Number(result.fee),
        memo: result.memo,
        tradedAt: result.tradedAt,
      },
    });
  } catch (error) {
    console.error("거래 수정 오류:", error);
    return NextResponse.json(
      { error: "거래 수정에 실패했습니다." },
      { status: 500 }
    );
  }
}

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

    if (!transaction.isManual) {
      return NextResponse.json(
        { error: "자동 동기화된 거래는 삭제할 수 없습니다." },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.transaction.delete({
        where: { id },
      });

      await recalculatePortfolio(tx, transaction.portfolioId);
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
