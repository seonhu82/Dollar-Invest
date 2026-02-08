import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH: 알림 수정 (활성화/비활성화)
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
    const { isActive } = body;

    const existing = await prisma.alert.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "알림을 찾을 수 없습니다." }, { status: 404 });
    }

    const alert = await prisma.alert.update({
      where: { id },
      data: {
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({
      alert: {
        id: alert.id,
        isActive: alert.isActive,
      },
    });
  } catch (error) {
    console.error("알림 수정 오류:", error);
    return NextResponse.json(
      { error: "알림 수정에 실패했습니다." },
      { status: 500 }
    );
  }
}

// DELETE: 알림 삭제
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

    const existing = await prisma.alert.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "알림을 찾을 수 없습니다." }, { status: 404 });
    }

    await prisma.alert.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("알림 삭제 오류:", error);
    return NextResponse.json(
      { error: "알림 삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}
