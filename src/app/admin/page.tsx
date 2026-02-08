"use client";

import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import {
  Users,
  UserCheck,
  UserX,
  Crown,
  Shield,
  Wallet,
  ArrowRightLeft,
  Search,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Ban,
  CheckCircle,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  Loader2,
} from "lucide-react";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isPro: boolean;
  isActive: boolean;
  suspendedAt: string | null;
  suspendReason: string | null;
  createdAt: string;
  portfolioCount: number;
  transactionCount: number;
}

interface Stats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  proUsers: number;
  adminUsers: number;
  totalPortfolios: number;
  totalTransactions: number;
  recentUsers: number;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "슈퍼 관리자",
  ADMIN: "관리자",
  USER: "일반 사용자",
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "text-red-600 bg-red-100",
  ADMIN: "text-blue-600 bg-blue-100",
  USER: "text-gray-600 bg-gray-100",
};

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 필터 & 페이지네이션
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // 액션 상태
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showActions, setShowActions] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [page, roleFilter, statusFilter]);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/admin/stats");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      setStats(data.stats);
    } catch (err) {
      console.error("통계 조회 오류:", err);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
      });

      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      setUsers(data.users);
      setTotalPages(data.pagination.totalPages);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "사용자 목록을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleUpdateUser = async (
    userId: string,
    updates: { role?: string; isActive?: boolean; isPro?: boolean; suspendReason?: string }
  ) => {
    setActionLoading(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...updates }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      await fetchUsers();
      await fetchStats();
      setShowActions(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "수정에 실패했습니다.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("정말로 이 사용자를 삭제하시겠습니까? 모든 데이터가 삭제됩니다.")) {
      return;
    }

    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users?userId=${userId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      await fetchUsers();
      await fetchStats();
      setShowActions(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    } finally {
      setActionLoading(null);
    }
  };

  if (error === "관리자 권한이 필요합니다.") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-20">
            <ShieldAlert className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">접근 권한이 없습니다</h1>
            <p className="text-muted-foreground">
              이 페이지는 관리자만 접근할 수 있습니다.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            관리자 대시보드
          </h1>
          <p className="text-muted-foreground">사용자 관리 및 시스템 현황</p>
        </div>

        {/* 통계 카드 */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  전체 사용자
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.totalUsers}</p>
                <p className="text-xs text-muted-foreground">
                  최근 7일 +{stats.recentUsers}명
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-green-600" />
                  활성 사용자
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">{stats.activeUsers}</p>
                <p className="text-xs text-muted-foreground">
                  정지: {stats.suspendedUsers}명
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Crown className="h-4 w-4 text-yellow-600" />
                  Pro 사용자
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-yellow-600">{stats.proUsers}</p>
                <p className="text-xs text-muted-foreground">
                  관리자: {stats.adminUsers}명
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4" />
                  총 거래
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.totalTransactions}</p>
                <p className="text-xs text-muted-foreground">
                  포트폴리오: {stats.totalPortfolios}개
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 사용자 목록 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>사용자 관리</CardTitle>

              {/* 필터 */}
              <div className="flex items-center gap-2">
                <select
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-2 border rounded-md bg-background text-sm"
                >
                  <option value="">전체 역할</option>
                  <option value="SUPER_ADMIN">슈퍼 관리자</option>
                  <option value="ADMIN">관리자</option>
                  <option value="USER">일반 사용자</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-2 border rounded-md bg-background text-sm"
                >
                  <option value="">전체 상태</option>
                  <option value="active">활성</option>
                  <option value="suspended">정지</option>
                </select>
              </div>
            </div>

            {/* 검색 */}
            <form onSubmit={handleSearch} className="flex gap-2 mt-4">
              <Input
                placeholder="이메일 또는 이름으로 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs"
              />
              <Button type="submit" variant="outline" size="icon">
                <Search className="h-4 w-4" />
              </Button>
            </form>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                사용자가 없습니다.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-3 font-medium">사용자</th>
                        <th className="pb-3 font-medium">역할</th>
                        <th className="pb-3 font-medium">상태</th>
                        <th className="pb-3 font-medium">Pro</th>
                        <th className="pb-3 font-medium">활동</th>
                        <th className="pb-3 font-medium">가입일</th>
                        <th className="pb-3 font-medium text-right">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="border-b last:border-0">
                          <td className="py-3">
                            <div>
                              <p className="font-medium">{user.name || "-"}</p>
                              <p className="text-sm text-muted-foreground">
                                {user.email}
                              </p>
                            </div>
                          </td>
                          <td className="py-3">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                ROLE_COLORS[user.role] || ROLE_COLORS.USER
                              }`}
                            >
                              {ROLE_LABELS[user.role] || user.role}
                            </span>
                          </td>
                          <td className="py-3">
                            {user.isActive ? (
                              <span className="flex items-center gap-1 text-green-600 text-sm">
                                <CheckCircle className="h-4 w-4" />
                                활성
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-red-600 text-sm">
                                <Ban className="h-4 w-4" />
                                정지
                              </span>
                            )}
                          </td>
                          <td className="py-3">
                            {user.isPro ? (
                              <Crown className="h-4 w-4 text-yellow-600" />
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-3 text-sm text-muted-foreground">
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1">
                                <Wallet className="h-3 w-3" />
                                {user.portfolioCount}
                              </span>
                              <span className="flex items-center gap-1">
                                <ArrowRightLeft className="h-3 w-3" />
                                {user.transactionCount}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 text-sm text-muted-foreground">
                            {new Date(user.createdAt).toLocaleDateString("ko-KR")}
                          </td>
                          <td className="py-3 text-right relative">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setShowActions(showActions === user.id ? null : user.id)
                              }
                              disabled={actionLoading === user.id}
                            >
                              {actionLoading === user.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>

                            {/* 액션 메뉴 */}
                            {showActions === user.id && (
                              <div className="absolute right-0 top-full mt-1 bg-background border rounded-md shadow-lg z-10 min-w-[160px]">
                                {/* 역할 변경 */}
                                {user.role !== "SUPER_ADMIN" && (
                                  <>
                                    {user.role === "USER" && (
                                      <button
                                        className="w-full px-4 py-2 text-left text-sm hover:bg-secondary flex items-center gap-2"
                                        onClick={() =>
                                          handleUpdateUser(user.id, { role: "ADMIN" })
                                        }
                                      >
                                        <ShieldCheck className="h-4 w-4" />
                                        관리자로 승급
                                      </button>
                                    )}
                                    {user.role === "ADMIN" && (
                                      <button
                                        className="w-full px-4 py-2 text-left text-sm hover:bg-secondary flex items-center gap-2"
                                        onClick={() =>
                                          handleUpdateUser(user.id, { role: "USER" })
                                        }
                                      >
                                        <Users className="h-4 w-4" />
                                        일반으로 변경
                                      </button>
                                    )}
                                  </>
                                )}

                                {/* 정지/해제 */}
                                {user.role !== "SUPER_ADMIN" && (
                                  <>
                                    {user.isActive ? (
                                      <button
                                        className="w-full px-4 py-2 text-left text-sm hover:bg-secondary flex items-center gap-2 text-red-600"
                                        onClick={() => {
                                          const reason = prompt("정지 사유를 입력하세요:");
                                          if (reason !== null) {
                                            handleUpdateUser(user.id, {
                                              isActive: false,
                                              suspendReason: reason,
                                            });
                                          }
                                        }}
                                      >
                                        <Ban className="h-4 w-4" />
                                        계정 정지
                                      </button>
                                    ) : (
                                      <button
                                        className="w-full px-4 py-2 text-left text-sm hover:bg-secondary flex items-center gap-2 text-green-600"
                                        onClick={() =>
                                          handleUpdateUser(user.id, { isActive: true })
                                        }
                                      >
                                        <CheckCircle className="h-4 w-4" />
                                        정지 해제
                                      </button>
                                    )}
                                  </>
                                )}

                                {/* Pro 토글 */}
                                <button
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-secondary flex items-center gap-2"
                                  onClick={() =>
                                    handleUpdateUser(user.id, { isPro: !user.isPro })
                                  }
                                >
                                  <Crown className="h-4 w-4" />
                                  {user.isPro ? "Pro 해제" : "Pro 부여"}
                                </button>

                                {/* 삭제 */}
                                {user.role !== "SUPER_ADMIN" && (
                                  <button
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-secondary flex items-center gap-2 text-red-600 border-t"
                                    onClick={() => handleDeleteUser(user.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    사용자 삭제
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 페이지네이션 */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>

      {/* 클릭 외부 영역 클릭 시 메뉴 닫기 */}
      {showActions && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowActions(null)}
        />
      )}
    </div>
  );
}
