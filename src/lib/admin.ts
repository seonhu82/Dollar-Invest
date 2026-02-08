/**
 * 관리자 권한 관리
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type UserRole = "SUPER_ADMIN" | "ADMIN" | "USER";

export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  USER: "USER",
} as const;

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "슈퍼 관리자",
  ADMIN: "관리자",
  USER: "일반 사용자",
};

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 50,
  USER: 0,
};

/**
 * 현재 사용자가 관리자인지 확인
 */
export async function isAdmin(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  return user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
}

/**
 * 현재 사용자가 슈퍼 관리자인지 확인
 */
export async function isSuperAdmin(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  return user?.role === "SUPER_ADMIN";
}

/**
 * 사용자 역할 가져오기
 */
export async function getUserRole(userId: string): Promise<UserRole | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  return (user?.role as UserRole) || null;
}

/**
 * 역할 변경 가능 여부 확인
 * - SUPER_ADMIN만 ADMIN 이상으로 변경 가능
 * - ADMIN은 USER 역할만 관리 가능
 */
export function canChangeRole(
  currentUserRole: UserRole,
  targetRole: UserRole
): boolean {
  const currentLevel = ROLE_HIERARCHY[currentUserRole];
  const targetLevel = ROLE_HIERARCHY[targetRole];

  // SUPER_ADMIN은 모든 역할 변경 가능
  if (currentUserRole === "SUPER_ADMIN") return true;

  // ADMIN은 USER 역할만 설정 가능
  if (currentUserRole === "ADMIN") {
    return targetLevel < ROLE_HIERARCHY.ADMIN;
  }

  return false;
}

/**
 * 사용자를 관리할 수 있는지 확인
 */
export function canManageUser(
  managerRole: UserRole,
  targetRole: UserRole
): boolean {
  const managerLevel = ROLE_HIERARCHY[managerRole];
  const targetLevel = ROLE_HIERARCHY[targetRole];

  // 자신보다 낮은 등급만 관리 가능
  return managerLevel > targetLevel;
}

/**
 * 첫 번째 사용자를 슈퍼 관리자로 설정
 */
export async function ensureSuperAdmin(): Promise<void> {
  const userCount = await prisma.user.count();

  if (userCount === 1) {
    const firstUser = await prisma.user.findFirst({
      orderBy: { createdAt: "asc" },
    });

    if (firstUser && firstUser.role === "USER") {
      await prisma.user.update({
        where: { id: firstUser.id },
        data: { role: "SUPER_ADMIN" },
      });
      console.log(`첫 번째 사용자 ${firstUser.email}를 슈퍼 관리자로 설정했습니다.`);
    }
  }
}
