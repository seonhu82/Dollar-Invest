import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";

// GET: 관리자 대시보드 통계
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const adminCheck = await isAdmin();
    if (!adminCheck) {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }

    // 통계 데이터 조회
    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      proUsers,
      adminUsers,
      totalPortfolios,
      totalTransactions,
      recentUsers,
    ] = await Promise.all([
      // 전체 사용자 수
      prisma.user.count(),
      // 활성 사용자 수
      prisma.user.count({ where: { isActive: true } }),
      // 정지된 사용자 수
      prisma.user.count({ where: { isActive: false } }),
      // 프로 사용자 수
      prisma.user.count({ where: { isPro: true } }),
      // 관리자 수
      prisma.user.count({
        where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
      }),
      // 전체 포트폴리오 수
      prisma.portfolio.count(),
      // 전체 거래 수
      prisma.transaction.count(),
      // 최근 가입 사용자 (7일)
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // 역할별 사용자 수
    const usersByRole = await prisma.user.groupBy({
      by: ["role"],
      _count: true,
    });

    // 일별 가입자 수 (최근 30일)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dailySignups = await prisma.user.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // 일별 그룹화
    const signupsByDate: Record<string, number> = {};
    dailySignups.forEach((user) => {
      const date = user.createdAt.toISOString().split("T")[0];
      signupsByDate[date] = (signupsByDate[date] || 0) + 1;
    });

    return NextResponse.json({
      stats: {
        totalUsers,
        activeUsers,
        suspendedUsers,
        proUsers,
        adminUsers,
        totalPortfolios,
        totalTransactions,
        recentUsers,
      },
      usersByRole: usersByRole.reduce(
        (acc, item) => {
          acc[item.role] = item._count;
          return acc;
        },
        {} as Record<string, number>
      ),
      signupsByDate,
    });
  } catch (error) {
    console.error("통계 조회 오류:", error);
    return NextResponse.json(
      { error: "통계를 불러오는데 실패했습니다." },
      { status: 500 }
    );
  }
}
