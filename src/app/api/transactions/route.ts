import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";

// 거래 생성 스키마
const createTransactionSchema = z.object({
  portfolioId: z.string().min(1, "포트폴리오를 선택해주세요"),
  type: z.enum(["BUY", "SELL"]),
  amount: z.number().positive("금액은 0보다 커야 합니다"),
  rate: z.number().positive("환율은 0보다 커야 합니다"),
  fee: z.number().min(0).optional().default(0),
  memo: z.string().max(200).optional(),
  tradedAt: z.string().optional(), // ISO date string
});

// GET: 거래 내역 조회
export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const portfolioId = searchParams.get("portfolioId");
    const type = searchParams.get("type"); // BUY or SELL
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const where: {
      userId: string;
      portfolioId?: string;
      type?: string;
    } = {
      userId: session.user.id,
    };

    if (portfolioId) where.portfolioId = portfolioId;
    if (type) where.type = type;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          portfolio: {
            select: { name: true, currency: true },
          },
        },
        orderBy: { tradedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.transaction.count({ where }),
    ]);

    return NextResponse.json({
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        currency: t.currency,
        amount: Number(t.amount),
        rate: Number(t.rate),
        krwAmount: Number(t.krwAmount),
        fee: Number(t.fee),
        memo: t.memo,
        tradedAt: t.tradedAt,
        isManual: t.isManual,
        portfolioId: t.portfolioId,
        portfolioName: t.portfolio.name,
      })),
      total,
      hasMore: offset + transactions.length < total,
    });
  } catch (error) {
    console.error("거래 내역 조회 오류:", error);
    return NextResponse.json(
      { error: "거래 내역을 불러오는데 실패했습니다." },
      { status: 500 }
    );
  }
}

// POST: 거래 생성 (수동 입력)
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const validation = createTransactionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { portfolioId, type, amount, rate, fee, memo, tradedAt } = validation.data;

    // 포트폴리오 소유권 확인
    const portfolio = await prisma.portfolio.findFirst({
      where: {
        id: portfolioId,
        userId: session.user.id,
      },
    });

    if (!portfolio) {
      return NextResponse.json(
        { error: "포트폴리오를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 매도 시 잔액 확인
    if (type === "SELL" && Number(portfolio.currentBalance) < amount) {
      return NextResponse.json(
        { error: "보유량이 부족합니다." },
        { status: 400 }
      );
    }

    // 원화 금액 계산
    const krwAmount = amount * rate + fee;

    // 트랜잭션 실행
    const result = await prisma.$transaction(async (tx) => {
      // 거래 생성
      const transaction = await tx.transaction.create({
        data: {
          userId: session.user.id,
          portfolioId,
          type,
          currency: portfolio.currency,
          amount,
          rate,
          krwAmount,
          fee,
          memo,
          tradedAt: tradedAt ? new Date(tradedAt) : new Date(),
          isManual: true,
        },
      });

      // 포트폴리오 업데이트
      const currentBalance = Number(portfolio.currentBalance);
      const currentAvgRate = Number(portfolio.avgBuyRate);
      const currentInvested = Number(portfolio.totalInvested);

      let newBalance: number;
      let newAvgRate: number;
      let newInvested: number;

      if (type === "BUY") {
        // 매수: 잔액 증가, 평균 단가 재계산
        newBalance = currentBalance + amount;
        newAvgRate =
          newBalance > 0
            ? (currentBalance * currentAvgRate + amount * rate) / newBalance
            : rate;
        newInvested = currentInvested + krwAmount;
      } else {
        // 매도: 잔액 감소
        newBalance = currentBalance - amount;
        newAvgRate = currentAvgRate; // 평균 단가는 유지
        newInvested = newBalance > 0
          ? currentInvested * (newBalance / currentBalance)
          : 0;
      }

      await tx.portfolio.update({
        where: { id: portfolioId },
        data: {
          currentBalance: newBalance,
          avgBuyRate: newAvgRate,
          totalInvested: newInvested,
        },
      });

      return transaction;
    });

    return NextResponse.json({
      transaction: {
        id: result.id,
        type: result.type,
        amount: Number(result.amount),
        rate: Number(result.rate),
        krwAmount: Number(result.krwAmount),
        tradedAt: result.tradedAt,
      },
    });
  } catch (error) {
    console.error("거래 생성 오류:", error);
    return NextResponse.json(
      { error: "거래 등록에 실패했습니다." },
      { status: 500 }
    );
  }
}
