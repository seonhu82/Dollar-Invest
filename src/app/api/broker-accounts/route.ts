import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: 연동된 증권사 계정 목록
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const accounts = await prisma.brokerAccount.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      include: {
        portfolios: {
          select: {
            id: true,
            name: true,
            currency: true,
            currentBalance: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      accounts: accounts.map((acc) => ({
        id: acc.id,
        broker: acc.broker,
        accountNo: acc.broker === "HANA" ? acc.hanaAccountNo : acc.kisAccountNo,
        accountAlias: acc.accountAlias,
        lastSyncAt: acc.lastSyncAt,
        portfolios: acc.portfolios.map((p) => ({
          id: p.id,
          name: p.name,
          currency: p.currency,
          balance: Number(p.currentBalance),
        })),
      })),
    });
  } catch (error) {
    console.error("계정 조회 오류:", error);
    return NextResponse.json(
      { error: "계정 목록을 불러오는데 실패했습니다." },
      { status: 500 }
    );
  }
}

// DELETE: 증권사 계정 연동 해제
export async function DELETE(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("id");

    if (!accountId) {
      return NextResponse.json({ error: "계정 ID가 필요합니다." }, { status: 400 });
    }

    const account = await prisma.brokerAccount.findFirst({
      where: {
        id: accountId,
        userId: session.user.id,
      },
    });

    if (!account) {
      return NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 });
    }

    // 비활성화 (데이터는 유지)
    await prisma.brokerAccount.update({
      where: { id: accountId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("계정 삭제 오류:", error);
    return NextResponse.json(
      { error: "계정 연동 해제에 실패했습니다." },
      { status: 500 }
    );
  }
}
