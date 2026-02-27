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
  let totalRealizedPnl = 0;

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
      if (t.realizedPnl !== null) {
        totalRealizedPnl += Number(t.realizedPnl);
      }
    }
  }

  const avgBuyRate = balance > 0 ? totalCost / balance : 0;

  await tx.portfolio.update({
    where: { id: portfolioId },
    data: {
      currentBalance: balance,
      avgBuyRate,
      totalInvested,
      totalRealizedPnl,
    },
  });
}

// PATCH: 거래 수정 (환율, 금액, 수수료, 메모, 진입가)
const updateTransactionSchema = z.object({
  rate: z.number().positive("환율은 0보다 커야 합니다").optional(),
  amount: z.number().positive("금액은 0보다 커야 합니다").optional(),
  fee: z.number().min(0).optional(),
  memo: z.string().max(200).optional().nullable(),
  entryRate: z.number().positive().optional().nullable(),
  linkedBuyId: z.string().optional().nullable(),
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

      // 진입가 및 실현손익 재계산 (SELL 거래만)
      let entryRateUpdate: number | null | undefined = undefined;
      let linkedBuyIdUpdate: string | null | undefined = undefined;
      let realizedPnlUpdate: number | null | undefined = undefined;

      if (transaction.type === "SELL") {
        if (updates.linkedBuyId !== undefined) {
          if (updates.linkedBuyId) {
            const buyTx = await tx.transaction.findFirst({
              where: { id: updates.linkedBuyId, portfolioId: transaction.portfolioId, type: "BUY" },
            });
            if (buyTx) {
              entryRateUpdate = Number(buyTx.rate);
              linkedBuyIdUpdate = updates.linkedBuyId;
            }
          } else {
            linkedBuyIdUpdate = null;
          }
        }

        if (updates.entryRate !== undefined) {
          entryRateUpdate = updates.entryRate;
        }

        // 진입가가 변경되었으면 realizedPnl 재계산
        if (entryRateUpdate !== undefined) {
          if (entryRateUpdate !== null) {
            realizedPnlUpdate = (newRate - entryRateUpdate) * newAmount;
          } else {
            realizedPnlUpdate = null;
          }
        } else if (updates.rate !== undefined || updates.amount !== undefined) {
          // 환율/금액이 변경되었고 기존 진입가가 있으면 재계산
          const existingEntryRate = transaction.entryRate ? Number(transaction.entryRate) : null;
          if (existingEntryRate !== null) {
            realizedPnlUpdate = (newRate - existingEntryRate) * newAmount;
          }
        }
      }

      const updated = await tx.transaction.update({
        where: { id },
        data: {
          ...(updates.rate !== undefined && { rate: updates.rate }),
          ...(updates.amount !== undefined && { amount: updates.amount }),
          ...(updates.fee !== undefined && { fee: updates.fee }),
          ...(updates.memo !== undefined && { memo: updates.memo }),
          ...(entryRateUpdate !== undefined && { entryRate: entryRateUpdate }),
          ...(linkedBuyIdUpdate !== undefined && { linkedBuyId: linkedBuyIdUpdate }),
          ...(realizedPnlUpdate !== undefined && { realizedPnl: realizedPnlUpdate }),
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
        entryRate: result.entryRate ? Number(result.entryRate) : null,
        realizedPnl: result.realizedPnl ? Number(result.realizedPnl) : null,
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
      // BUY 삭제 시 연결된 SELL의 linkedBuyId를 null로 (entryRate는 보존)
      if (transaction.type === "BUY") {
        await tx.transaction.updateMany({
          where: { linkedBuyId: id },
          data: { linkedBuyId: null },
        });
      }

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
