import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncKISTransactions } from "@/lib/kis";

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

    // 동기화 실행
    const result = await syncKISTransactions(session.user.id, brokerAccountId);

    return NextResponse.json({
      success: true,
      synced: result.synced,
      message: result.message,
    });
  } catch (error) {
    console.error("KIS 동기화 오류:", error);

    const errorMessage =
      error instanceof Error ? error.message : "동기화에 실패했습니다.";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
