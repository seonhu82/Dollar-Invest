import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: 알림 로그 조회
export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const unreadOnly = searchParams.get("unread") === "true";

    const where: {
      userId: string;
      isRead?: boolean;
    } = {
      userId: session.user.id,
    };

    if (unreadOnly) {
      where.isRead = false;
    }

    const [logs, unreadCount] = await Promise.all([
      prisma.alertLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.alertLog.count({
        where: { userId: session.user.id, isRead: false },
      }),
    ]);

    return NextResponse.json({
      logs: logs.map((log) => ({
        id: log.id,
        type: log.type,
        title: log.title,
        message: log.message,
        rate: log.rate ? Number(log.rate) : null,
        isRead: log.isRead,
        createdAt: log.createdAt,
      })),
      unreadCount,
    });
  } catch (error) {
    console.error("알림 로그 조회 오류:", error);
    return NextResponse.json(
      { error: "알림 로그를 불러오는데 실패했습니다." },
      { status: 500 }
    );
  }
}

// PATCH: 알림 읽음 처리
export async function PATCH(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const { logIds, markAllRead } = body;

    if (markAllRead) {
      // 모두 읽음 처리
      await prisma.alertLog.updateMany({
        where: {
          userId: session.user.id,
          isRead: false,
        },
        data: { isRead: true },
      });
    } else if (logIds && Array.isArray(logIds)) {
      // 특정 알림만 읽음 처리
      await prisma.alertLog.updateMany({
        where: {
          id: { in: logIds },
          userId: session.user.id,
        },
        data: { isRead: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("알림 읽음 처리 오류:", error);
    return NextResponse.json(
      { error: "알림 읽음 처리에 실패했습니다." },
      { status: 500 }
    );
  }
}
