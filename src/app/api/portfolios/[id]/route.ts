import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// 포트폴리오 수정 스키마
const updatePortfolioSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().optional(),
  isDefault: z.boolean().optional(),
});

// GET: 포트폴리오 상세 조회
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const portfolio = await prisma.portfolio.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        brokerAccount: {
          select: {
            broker: true,
            accountAlias: true,
          },
        },
        transactions: {
          orderBy: { tradedAt: "desc" },
          take: 10,
        },
      },
    });

    if (!portfolio) {
      return NextResponse.json(
        { error: "포트폴리오를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      portfolio: {
        id: portfolio.id,
        name: portfolio.name,
        currency: portfolio.currency,
        description: portfolio.description,
        isDefault: portfolio.isDefault,
        currentBalance: Number(portfolio.currentBalance),
        avgBuyRate: Number(portfolio.avgBuyRate),
        totalInvested: Number(portfolio.totalInvested),
        broker: portfolio.brokerAccount?.broker || "MANUAL",
        brokerAccountId: portfolio.brokerAccountId,
        accountAlias: portfolio.brokerAccount?.accountAlias,
        createdAt: portfolio.createdAt,
        updatedAt: portfolio.updatedAt,
        recentTransactions: portfolio.transactions.map((t) => ({
          id: t.id,
          type: t.type,
          amount: Number(t.amount),
          rate: Number(t.rate),
          krwAmount: Number(t.krwAmount),
          tradedAt: t.tradedAt,
          memo: t.memo,
        })),
      },
    });
  } catch (error) {
    console.error("포트폴리오 조회 오류:", error);
    return NextResponse.json(
      { error: "포트폴리오를 불러오는데 실패했습니다." },
      { status: 500 }
    );
  }
}

// PATCH: 포트폴리오 수정
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
    const validation = updatePortfolioSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    // 포트폴리오 소유권 확인
    const existing = await prisma.portfolio.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "포트폴리오를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const { name, description, isDefault } = validation.data;

    // 기본 포트폴리오 설정 시 다른 포트폴리오 해제
    if (isDefault === true) {
      await prisma.portfolio.updateMany({
        where: {
          userId: session.user.id,
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }

    const portfolio = await prisma.portfolio.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(isDefault !== undefined && { isDefault }),
      },
    });

    return NextResponse.json({
      portfolio: {
        id: portfolio.id,
        name: portfolio.name,
        currency: portfolio.currency,
        description: portfolio.description,
        isDefault: portfolio.isDefault,
      },
    });
  } catch (error) {
    console.error("포트폴리오 수정 오류:", error);
    return NextResponse.json(
      { error: "포트폴리오 수정에 실패했습니다." },
      { status: 500 }
    );
  }
}

// DELETE: 포트폴리오 삭제
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

    // 포트폴리오 소유권 확인
    const existing = await prisma.portfolio.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "포트폴리오를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 기본 포트폴리오는 삭제 불가
    if (existing.isDefault) {
      return NextResponse.json(
        { error: "기본 포트폴리오는 삭제할 수 없습니다." },
        { status: 400 }
      );
    }

    await prisma.portfolio.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("포트폴리오 삭제 오류:", error);
    return NextResponse.json(
      { error: "포트폴리오 삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}
