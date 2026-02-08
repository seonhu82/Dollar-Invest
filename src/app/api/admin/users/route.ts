import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin, getUserRole, canManageUser, UserRole } from "@/lib/admin";

// GET: 사용자 목록 조회
export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const adminCheck = await isAdmin();
    if (!adminCheck) {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const search = searchParams.get("search") || "";
    const role = searchParams.get("role") || "";
    const status = searchParams.get("status") || "";

    const where: {
      OR?: { email?: { contains: string }; name?: { contains: string } }[];
      role?: string;
      isActive?: boolean;
    } = {};

    if (search) {
      where.OR = [
        { email: { contains: search } },
        { name: { contains: search } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (status === "active") {
      where.isActive = true;
    } else if (status === "suspended") {
      where.isActive = false;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isPro: true,
          proExpiresAt: true,
          isActive: true,
          suspendedAt: true,
          suspendReason: true,
          createdAt: true,
          _count: {
            select: {
              portfolios: true,
              transactions: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      users: users.map((user) => ({
        ...user,
        portfolioCount: user._count.portfolios,
        transactionCount: user._count.transactions,
        _count: undefined,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("사용자 목록 조회 오류:", error);
    return NextResponse.json(
      { error: "사용자 목록을 불러오는데 실패했습니다." },
      { status: 500 }
    );
  }
}

// PATCH: 사용자 정보 수정 (역할, 상태 등)
export async function PATCH(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const adminCheck = await isAdmin();
    if (!adminCheck) {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }

    const body = await request.json();
    const { userId, role, isActive, isPro, suspendReason } = body;

    if (!userId) {
      return NextResponse.json({ error: "사용자 ID가 필요합니다." }, { status: 400 });
    }

    // 대상 사용자 조회
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, email: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    // 현재 사용자의 역할 확인
    const currentUserRole = await getUserRole(session.user.id);

    if (!currentUserRole) {
      return NextResponse.json({ error: "권한을 확인할 수 없습니다." }, { status: 403 });
    }

    // 자신보다 높거나 같은 등급은 관리 불가
    if (!canManageUser(currentUserRole, targetUser.role as UserRole)) {
      return NextResponse.json(
        { error: "해당 사용자를 관리할 권한이 없습니다." },
        { status: 403 }
      );
    }

    // 자기 자신은 수정 불가 (역할 변경 시)
    if (userId === session.user.id && role) {
      return NextResponse.json(
        { error: "자신의 역할은 변경할 수 없습니다." },
        { status: 400 }
      );
    }

    // 업데이트할 데이터 구성
    const updateData: {
      role?: string;
      isActive?: boolean;
      isPro?: boolean;
      suspendedAt?: Date | null;
      suspendReason?: string | null;
    } = {};

    if (role !== undefined) {
      // 역할 변경 권한 확인
      if (currentUserRole !== "SUPER_ADMIN" && role !== "USER") {
        return NextResponse.json(
          { error: "관리자 역할은 슈퍼 관리자만 부여할 수 있습니다." },
          { status: 403 }
        );
      }
      updateData.role = role;
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
      if (!isActive) {
        updateData.suspendedAt = new Date();
        updateData.suspendReason = suspendReason || "관리자에 의해 정지됨";
      } else {
        updateData.suspendedAt = null;
        updateData.suspendReason = null;
      }
    }

    if (isPro !== undefined) {
      updateData.isPro = isPro;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isPro: true,
        isActive: true,
        suspendedAt: true,
        suspendReason: true,
      },
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.error("사용자 수정 오류:", error);
    return NextResponse.json(
      { error: "사용자 정보 수정에 실패했습니다." },
      { status: 500 }
    );
  }
}

// DELETE: 사용자 삭제
export async function DELETE(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const currentUserRole = await getUserRole(session.user.id);

    // 슈퍼 관리자만 삭제 가능
    if (currentUserRole !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "슈퍼 관리자만 사용자를 삭제할 수 있습니다." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "사용자 ID가 필요합니다." }, { status: 400 });
    }

    // 자기 자신 삭제 불가
    if (userId === session.user.id) {
      return NextResponse.json(
        { error: "자신의 계정은 삭제할 수 없습니다." },
        { status: 400 }
      );
    }

    // 대상 사용자 확인
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    // 슈퍼 관리자는 삭제 불가
    if (targetUser.role === "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "슈퍼 관리자는 삭제할 수 없습니다." },
        { status: 400 }
      );
    }

    // 사용자 삭제 (관련 데이터는 CASCADE로 자동 삭제)
    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("사용자 삭제 오류:", error);
    return NextResponse.json(
      { error: "사용자 삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}
