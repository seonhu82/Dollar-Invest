"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ExchangeAlertBanner } from "@/components/exchange/ExchangeAlertBanner";
import { useUserActivity } from "@/hooks/useUserActivity";
import {
  DollarSign,
  LayoutDashboard,
  LineChart,
  Wallet,
  Bell,
  Settings,
  LogOut,
  User,
  Shield,
} from "lucide-react";

const navigation = [
  { name: "대시보드", href: "/", icon: LayoutDashboard },
  { name: "환율", href: "/exchange", icon: LineChart },
  { name: "포트폴리오", href: "/portfolio", icon: Wallet },
  { name: "거래", href: "/trade", icon: DollarSign },
  { name: "알림", href: "/alerts", icon: Bell },
  { name: "설정", href: "/settings", icon: Settings },
];

export function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isIdle = useUserActivity(60000); // 1분 비활동 시 대기 모드

  // 사용자 역할 확인
  useEffect(() => {
    if (session?.user?.id) {
      fetch("/api/auth/me")
        .then((res) => res.json())
        .then((data) => {
          if (data.user?.role) {
            setUserRole(data.user.role);
          }
        })
        .catch(() => {});
    }
  }, [session?.user?.id]);

  // 읽지 않은 알림 수 조회
  const fetchUnreadCount = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const res = await fetch("/api/alerts/logs?unread=true&limit=1");
      const data = await res.json();
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // 무시
    }
  }, [session?.user?.id]);

  // 알림 조건 체크 + 브라우저 알림
  const checkAndNotify = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const res = await fetch("/api/cron/check-alerts");
      const data = await res.json();

      if (data.triggered > 0) {
        // 읽지 않은 알림 수 새로고침
        fetchUnreadCount();

        // 브라우저 알림 표시
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("달러인베스트 알림", {
            body: `${data.triggered}건의 새로운 환율 알림이 발생했습니다.`,
            icon: "/favicon.ico",
            tag: "dollar-invest-alert",
          });
        }
      }
    } catch {
      // 무시
    }
  }, [session?.user?.id, fetchUnreadCount]);

  // 초기 로드 + 주기적 체크
  useEffect(() => {
    if (!session?.user?.id || isIdle) return;

    fetchUnreadCount();
    checkAndNotify();

    // 5분마다 알림 체크
    checkIntervalRef.current = setInterval(() => {
      checkAndNotify();
    }, 5 * 60 * 1000);

    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [session?.user?.id, fetchUnreadCount, checkAndNotify, isIdle]);

  // 알림 페이지 진입 시 unread 새로고침
  useEffect(() => {
    if (pathname === "/alerts") {
      fetchUnreadCount();
    }
  }, [pathname, fetchUnreadCount]);

  const isAdmin = userRole === "ADMIN" || userRole === "SUPER_ADMIN";

  return (
    <>
    <header className="sticky top-0 z-50 w-full bg-[#f4f4f5]">
      <div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex h-14 items-center">
          {/* 로고 */}
          <Link href="/" className="mr-8 flex items-center space-x-2.5">
            <div className="p-1.5 bg-gray-900 rounded-lg">
              <DollarSign className="h-4 w-4 text-white" />
            </div>
            <span className="hidden font-semibold text-gray-900 sm:inline-block">
              달러인베스트
            </span>
          </Link>

          {/* 네비게이션 */}
          <nav className="flex items-center space-x-0.5 sm:space-x-1 text-sm overflow-x-auto scrollbar-hide">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              const isAlertNav = item.href === "/alerts";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex items-center space-x-1.5 px-2 sm:px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex-shrink-0",
                    isActive
                      ? "bg-white text-gray-900 font-medium shadow-sm"
                      : "text-gray-500 hover:text-gray-900 hover:bg-white/50"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="hidden lg:inline-block">{item.name}</span>
                  {/* 알림 배지 */}
                  {isAlertNav && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full leading-none animate-pulse">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
            {/* 관리자 메뉴 */}
            {isAdmin && (
              <Link
                href="/admin"
                className={cn(
                  "flex items-center space-x-1.5 px-2 sm:px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex-shrink-0",
                  pathname === "/admin"
                    ? "bg-red-100 text-red-700 font-medium shadow-sm"
                    : "text-red-500 hover:text-red-700 hover:bg-red-50"
                )}
              >
                <Shield className="h-4 w-4" />
                <span className="hidden lg:inline-block">관리자</span>
              </Link>
            )}
          </nav>

          {/* 우측 영역 */}
          <div className="ml-auto flex items-center space-x-4">
            {session ? (
              <div className="flex items-center space-x-3">
                <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-600">
                  <User className="h-4 w-4" />
                  <span>{session.user?.name || session.user?.email}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="text-gray-500 hover:text-gray-900"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">로그인</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>

    {/* 환율 알림 배너 - 헤더 아래 별도 영역 */}
    <ExchangeAlertBanner isIdle={isIdle} />
    </>
  );
}
