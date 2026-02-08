import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// 포트폴리오 생성 스키마
const createPortfolioSchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요").max(50),
  currency: z.string().default("USD"),
  description: z.string().optional(),
  brokerAccountId: z.string().optional(),
});

// GET: 포트폴리오 목록 조회
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const portfolios = await prisma.portfolio.findMany({
      where: { userId: session.user.id },
      include: {
        brokerAccount: {
          select: {
            broker: true,
            accountAlias: true,
          },
        },
        _count: {
          select: { transactions: true },
        },
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });

    // 포트폴리오 데이터 변환
    const result = portfolios.map((p) => ({
      id: p.id,
      name: p.name,
      currency: p.currency,
      description: p.description,
      isDefault: p.isDefault,
      currentBalance: Number(p.currentBalance),
      avgBuyRate: Number(p.avgBuyRate),
      totalInvested: Number(p.totalInvested),
      broker: p.brokerAccount?.broker || "MANUAL",
      brokerAccountId: p.brokerAccountId,
      accountAlias: p.brokerAccount?.accountAlias,
      transactionCount: p._count.transactions,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return NextResponse.json({ portfolios: result });
  } catch (error) {
    console.error("포트폴리오 조회 오류:", error);
    return NextResponse.json(
      { error: "포트폴리오를 불러오는데 실패했습니다." },
      { status: 500 }
    );
  }
}

// POST: 포트폴리오 생성
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const validation = createPortfolioSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, currency, description, brokerAccountId } = validation.data;

    // 첫 번째 포트폴리오인지 확인
    const existingCount = await prisma.portfolio.count({
      where: { userId: session.user.id },
    });

    const portfolio = await prisma.portfolio.create({
      data: {
        userId: session.user.id,
        name,
        currency,
        description,
        brokerAccountId,
        isDefault: existingCount === 0, // 첫 번째 포트폴리오는 기본값
      },
    });

    return NextResponse.json({
      portfolio: {
        id: portfolio.id,
        name: portfolio.name,
        currency: portfolio.currency,
        description: portfolio.description,
        isDefault: portfolio.isDefault,
        currentBalance: 0,
        avgBuyRate: 0,
        totalInvested: 0,
        broker: "MANUAL",
      },
    });
  } catch (error) {
    console.error("포트폴리오 생성 오류:", error);
    return NextResponse.json(
      { error: "포트폴리오 생성에 실패했습니다." },
      { status: 500 }
    );
  }
}
