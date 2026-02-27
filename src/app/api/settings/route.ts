import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET: 사용자 설정 조회
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        email: true,
        notifRateAlert: true,
        notifDailyReport: true,
        notifOrderComplete: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ settings: user });
  } catch (error) {
    console.error("설정 조회 오류:", error);
    return NextResponse.json({ error: "설정 조회에 실패했습니다." }, { status: 500 });
  }
}

// PATCH: 사용자 설정 저장
export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const { name, notifRateAlert, notifDailyReport, notifOrderComplete } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (notifRateAlert !== undefined) updateData.notifRateAlert = notifRateAlert;
    if (notifDailyReport !== undefined) updateData.notifDailyReport = notifDailyReport;
    if (notifOrderComplete !== undefined) updateData.notifOrderComplete = notifOrderComplete;

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        name: true,
        email: true,
        notifRateAlert: true,
        notifDailyReport: true,
        notifOrderComplete: true,
      },
    });

    return NextResponse.json({ success: true, settings: user });
  } catch (error) {
    console.error("설정 저장 오류:", error);
    return NextResponse.json({ error: "설정 저장에 실패했습니다." }, { status: 500 });
  }
}
