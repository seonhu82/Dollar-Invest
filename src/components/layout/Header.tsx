"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useBridgeStore } from "@/stores/bridgeStore";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  LayoutDashboard,
  LineChart,
  Wallet,
  Bell,
  Settings,
  Link2,
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
  { name: "연동", href: "/broker", icon: Link2 },
  { name: "설정", href: "/settings", icon: Settings },
];

export function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [userRole, setUserRole] = useState<string | null>(null);

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

  const isAdmin = userRole === "ADMIN" || userRole === "SUPER_ADMIN";

  return (
    <header className="sticky top-0 z-50 w-full bg-[#f4f4f5]">
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
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center space-x-1.5 px-2 sm:px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex-shrink-0",
                  isActive
                    ? "bg-white text-gray-900 font-medium shadow-sm"
                    : "text-gray-500 hover:text-gray-900 hover:bg-white/50"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden lg:inline-block">{item.name}</span>
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
          <BridgeStatusIndicator />

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
    </header>
  );
}

function BridgeStatusIndicator() {
  const { connected, hanaConnected, checkStatus, isChecking } = useBridgeStore();

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const statusText = hanaConnected
    ? "하나증권 연결됨"
    : connected
    ? "브릿지 연결됨"
    : "브릿지 미연결";

  const statusColor = hanaConnected
    ? "bg-green-500"
    : connected
    ? "bg-yellow-500"
    : "bg-gray-300";

  return (
    <div className="flex items-center space-x-2 text-sm">
      <div
        className={cn(
          "h-2 w-2 rounded-full transition-colors",
          isChecking && "animate-pulse",
          statusColor
        )}
      />
      <span className="hidden text-muted-foreground sm:inline-block">
        {statusText}
      </span>
    </div>
  );
}
