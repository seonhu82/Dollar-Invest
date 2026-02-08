import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hanaConnect, getBridgeStatus } from "@/lib/bridge";

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const { accountNo, accountAlias } = body;

    if (!accountNo) {
      return NextResponse.json({ error: "계좌번호를 입력해주세요." }, { status: 400 });
    }

    // 브릿지 상태 확인
    const status = await getBridgeStatus();
    if (!status.connected) {
      return NextResponse.json(
        { error: "PC 브릿지에 연결할 수 없습니다. 브릿지 프로그램을 실행해주세요." },
        { status: 503 }
      );
    }

    // 하나증권 연결 시도
    const result = await hanaConnect(accountNo);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message || "하나증권 연결에 실패했습니다." },
        { status: 400 }
      );
    }

    // DB에 계정 정보 저장/업데이트
    const existingAccount = await prisma.brokerAccount.findFirst({
      where: {
        userId: session.user.id,
        broker: "HANA",
        hanaAccountNo: accountNo,
      },
    });

    let brokerAccount;
    if (existingAccount) {
      brokerAccount = await prisma.brokerAccount.update({
        where: { id: existingAccount.id },
        data: {
          isActive: true,
          accountAlias: accountAlias || existingAccount.accountAlias,
          lastSyncAt: new Date(),
        },
      });
    } else {
      brokerAccount = await prisma.brokerAccount.create({
        data: {
          userId: session.user.id,
          broker: "HANA",
          hanaAccountNo: accountNo,
          accountAlias: accountAlias || `하나증권 ${accountNo.slice(-4)}`,
          isActive: true,
          lastSyncAt: new Date(),
        },
      });

      // 기본 포트폴리오 생성
      await prisma.portfolio.create({
        data: {
          userId: session.user.id,
          brokerAccountId: brokerAccount.id,
          name: `하나증권 달러`,
          currency: "USD",
          description: "하나증권 연동 포트폴리오",
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "하나증권 연결 완료",
      brokerAccountId: brokerAccount.id,
    });
  } catch (error) {
    console.error("하나증권 연결 오류:", error);
    return NextResponse.json(
      { error: "연결 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
