import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// 알림 생성 스키마
const createAlertSchema = z.object({
  currency: z.string().default("USD"),
  type: z.enum(["TARGET_RATE", "CHANGE_RATE", "DAILY"]),
  // TARGET_RATE: 목표 환율 도달
  targetRate: z.number().positive().optional(),
  direction: z.enum(["UP", "DOWN"]).optional(), // UP: 이상, DOWN: 이하
  // CHANGE_RATE: 변동률 알림
  changeRate: z.number().positive().optional(), // 변동 퍼센트
  // DAILY: 매일 알림
  dailyTime: z.string().optional(), // HH:MM 형식
});

// GET: 알림 목록 조회
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const alerts = await prisma.alert.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      alerts: alerts.map((alert) => ({
        id: alert.id,
        currency: alert.currency,
        type: alert.type,
        targetRate: alert.targetRate ? Number(alert.targetRate) : null,
        direction: alert.direction,
        changeRate: alert.changeRate ? Number(alert.changeRate) : null,
        dailyTime: alert.dailyTime,
        isActive: alert.isActive,
        lastTriggeredAt: alert.lastTriggeredAt,
        createdAt: alert.createdAt,
      })),
    });
  } catch (error) {
    console.error("알림 조회 오류:", error);
    return NextResponse.json(
      { error: "알림 목록을 불러오는데 실패했습니다." },
      { status: 500 }
    );
  }
}

// POST: 알림 생성
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const validation = createAlertSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { currency, type, targetRate, direction, changeRate, dailyTime } =
      validation.data;

    // 타입별 필수값 검증
    if (type === "TARGET_RATE" && (!targetRate || !direction)) {
      return NextResponse.json(
        { error: "목표 환율과 방향을 입력해주세요." },
        { status: 400 }
      );
    }

    if (type === "CHANGE_RATE" && !changeRate) {
      return NextResponse.json(
        { error: "변동률을 입력해주세요." },
        { status: 400 }
      );
    }

    if (type === "DAILY" && !dailyTime) {
      return NextResponse.json(
        { error: "알림 시간을 입력해주세요." },
        { status: 400 }
      );
    }

    const alert = await prisma.alert.create({
      data: {
        userId: session.user.id,
        currency,
        type,
        targetRate: targetRate || null,
        direction: direction || null,
        changeRate: changeRate || null,
        dailyTime: dailyTime || null,
        isActive: true,
      },
    });

    return NextResponse.json({
      alert: {
        id: alert.id,
        currency: alert.currency,
        type: alert.type,
        targetRate: alert.targetRate ? Number(alert.targetRate) : null,
        direction: alert.direction,
        changeRate: alert.changeRate ? Number(alert.changeRate) : null,
        dailyTime: alert.dailyTime,
        isActive: alert.isActive,
      },
    });
  } catch (error) {
    console.error("알림 생성 오류:", error);
    return NextResponse.json(
      { error: "알림 생성에 실패했습니다." },
      { status: 500 }
    );
  }
}
