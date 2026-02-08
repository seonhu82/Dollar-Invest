"use client";

import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { formatRate, formatDateTime } from "@/lib/utils";
import {
  Bell,
  Plus,
  Trash2,
  BellRing,
  TrendingUp,
  TrendingDown,
  Clock,
  X,
  Loader2,
  CheckCircle,
  RefreshCw,
} from "lucide-react";

interface Alert {
  id: string;
  currency: string;
  type: string;
  targetRate: number | null;
  direction: string | null;
  changeRate: number | null;
  dailyTime: string | null;
  isActive: boolean;
  lastTriggeredAt: string | null;
}

interface AlertLog {
  id: string;
  type: string;
  title: string;
  message: string;
  rate: number | null;
  isRead: boolean;
  createdAt: string;
}

export default function AlertsPage() {
  const [activeTab, setActiveTab] = useState<"settings" | "history">("settings");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [logs, setLogs] = useState<AlertLog[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // 생성 폼
  const [newAlertType, setNewAlertType] = useState<"TARGET_RATE" | "CHANGE_RATE" | "DAILY">("TARGET_RATE");
  const [newCurrency, setNewCurrency] = useState("USD");
  const [newTargetRate, setNewTargetRate] = useState("");
  const [newDirection, setNewDirection] = useState<"UP" | "DOWN">("UP");
  const [newChangeRate, setNewChangeRate] = useState("");
  const [newDailyTime, setNewDailyTime] = useState("09:00");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAlerts();
    fetchLogs();
  }, []);

  const fetchAlerts = async () => {
    try {
      const res = await fetch("/api/alerts");
      const data = await res.json();
      setAlerts(data.alerts || []);
    } catch {
      // 무시
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/alerts/logs");
      const data = await res.json();
      setLogs(data.logs || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // 무시
    }
  };

  const handleCreateAlert = async () => {
    setError("");
    setCreating(true);

    try {
      const body: Record<string, unknown> = {
        currency: newCurrency,
        type: newAlertType,
      };

      if (newAlertType === "TARGET_RATE") {
        body.targetRate = parseFloat(newTargetRate);
        body.direction = newDirection;
      } else if (newAlertType === "CHANGE_RATE") {
        body.changeRate = parseFloat(newChangeRate);
      } else if (newAlertType === "DAILY") {
        body.dailyTime = newDailyTime;
      }

      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      setShowCreateForm(false);
      setNewTargetRate("");
      setNewChangeRate("");
      await fetchAlerts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "알림 생성에 실패했습니다.");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleAlert = async (alertId: string, isActive: boolean) => {
    try {
      await fetch(`/api/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      await fetchAlerts();
    } catch {
      // 무시
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    if (!confirm("이 알림을 삭제하시겠습니까?")) return;

    try {
      await fetch(`/api/alerts/${alertId}`, { method: "DELETE" });
      await fetchAlerts();
    } catch {
      // 무시
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/alerts/logs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      await fetchLogs();
    } catch {
      // 무시
    }
  };

  const currencies = ["USD", "EUR", "JPY", "CNY", "GBP"];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">알림</h1>
            <p className="text-muted-foreground">환율 알림을 설정하고 관리하세요</p>
          </div>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            알림 추가
          </Button>
        </div>

        {/* 알림 생성 폼 */}
        {showCreateForm && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>새 알림 만들기</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowCreateForm(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">{error}</div>
              )}

              {/* 알림 유형 */}
              <div className="space-y-2">
                <Label>알림 유형</Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewAlertType("TARGET_RATE")}
                    className={`p-3 rounded-lg border text-center ${
                      newAlertType === "TARGET_RATE"
                        ? "border-primary bg-primary/5"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <TrendingUp className="h-5 w-5 mx-auto mb-1" />
                    <span className="text-sm">목표 환율</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewAlertType("CHANGE_RATE")}
                    className={`p-3 rounded-lg border text-center ${
                      newAlertType === "CHANGE_RATE"
                        ? "border-primary bg-primary/5"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <BellRing className="h-5 w-5 mx-auto mb-1" />
                    <span className="text-sm">변동률</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewAlertType("DAILY")}
                    className={`p-3 rounded-lg border text-center ${
                      newAlertType === "DAILY"
                        ? "border-primary bg-primary/5"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <Clock className="h-5 w-5 mx-auto mb-1" />
                    <span className="text-sm">매일 알림</span>
                  </button>
                </div>
              </div>

              {/* 통화 선택 */}
              <div className="space-y-2">
                <Label>통화</Label>
                <select
                  value={newCurrency}
                  onChange={(e) => setNewCurrency(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  {currencies.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* 목표 환율 */}
              {newAlertType === "TARGET_RATE" && (
                <>
                  <div className="space-y-2">
                    <Label>목표 환율</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder="1400"
                        value={newTargetRate}
                        onChange={(e) => setNewTargetRate(e.target.value)}
                        className="pr-12"
                        step="0.1"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        원
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>조건</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={newDirection === "UP" ? "default" : "outline"}
                        className="flex-1"
                        onClick={() => setNewDirection("UP")}
                      >
                        <TrendingUp className="h-4 w-4 mr-1" />
                        이상
                      </Button>
                      <Button
                        type="button"
                        variant={newDirection === "DOWN" ? "default" : "outline"}
                        className="flex-1"
                        onClick={() => setNewDirection("DOWN")}
                      >
                        <TrendingDown className="h-4 w-4 mr-1" />
                        이하
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* 변동률 */}
              {newAlertType === "CHANGE_RATE" && (
                <div className="space-y-2">
                  <Label>변동률</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="1.0"
                      value={newChangeRate}
                      onChange={(e) => setNewChangeRate(e.target.value)}
                      className="pr-12"
                      step="0.1"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      %
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    하루 중 환율이 설정한 퍼센트 이상 변동하면 알림
                  </p>
                </div>
              )}

              {/* 매일 알림 */}
              {newAlertType === "DAILY" && (
                <div className="space-y-2">
                  <Label>알림 시간</Label>
                  <Input
                    type="time"
                    value={newDailyTime}
                    onChange={(e) => setNewDailyTime(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    매일 설정한 시간에 현재 환율 알림
                  </p>
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleCreateAlert}
                disabled={creating}
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                알림 추가
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 탭 */}
        <div className="flex gap-2 border-b">
          <button
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === "settings"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("settings")}
          >
            알림 설정
          </button>
          <button
            className={`px-4 py-2 font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "history"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("history")}
          >
            알림 기록
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {activeTab === "settings" ? (
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : alerts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">설정된 알림이 없습니다.</p>
                  <Button className="mt-4" onClick={() => setShowCreateForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    첫 알림 추가하기
                  </Button>
                </CardContent>
              </Card>
            ) : (
              alerts.map((alert) => (
                <Card key={alert.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className={`p-2 rounded-full ${
                            alert.isActive
                              ? "bg-primary/10 text-primary"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {alert.type === "TARGET_RATE" ? (
                            alert.direction === "UP" ? (
                              <TrendingUp className="h-5 w-5" />
                            ) : (
                              <TrendingDown className="h-5 w-5" />
                            )
                          ) : alert.type === "CHANGE_RATE" ? (
                            <BellRing className="h-5 w-5" />
                          ) : (
                            <Clock className="h-5 w-5" />
                          )}
                        </div>

                        <div>
                          <div className="font-medium">
                            {alert.type === "TARGET_RATE" && (
                              <>
                                {alert.currency}{" "}
                                {alert.direction === "UP" ? "이상" : "이하"}{" "}
                                <span className="tabular-nums">
                                  {formatRate(alert.targetRate!)}원
                                </span>
                              </>
                            )}
                            {alert.type === "CHANGE_RATE" && (
                              <>
                                {alert.currency} 변동률 ±{alert.changeRate}%
                              </>
                            )}
                            {alert.type === "DAILY" && (
                              <>
                                {alert.currency} 매일 {alert.dailyTime} 알림
                              </>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {alert.lastTriggeredAt
                              ? `마지막 알림: ${formatDateTime(alert.lastTriggeredAt)}`
                              : "아직 알림이 발생하지 않았습니다"}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleAlert(alert.id, alert.isActive)}
                          className={alert.isActive ? "text-primary" : "text-muted-foreground"}
                        >
                          {alert.isActive ? (
                            <CheckCircle className="h-5 w-5" />
                          ) : (
                            <Bell className="h-5 w-5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteAlert(alert.id)}
                          className="text-muted-foreground hover:text-red-600"
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {unreadCount > 0 && (
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  모두 읽음
                </Button>
              </div>
            )}

            {logs.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">알림 기록이 없습니다.</p>
                </CardContent>
              </Card>
            ) : (
              logs.map((log) => (
                <Card key={log.id} className={log.isRead ? "opacity-60" : ""}>
                  <CardContent className="py-4">
                    <div className="flex items-start gap-4">
                      <div
                        className={`p-2 rounded-full shrink-0 ${
                          log.isRead
                            ? "bg-secondary text-muted-foreground"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        <BellRing className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{log.title}</h4>
                          <span className="text-sm text-muted-foreground">
                            {formatDateTime(log.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{log.message}</p>
                        {log.rate && (
                          <p className="text-sm mt-1">
                            환율:{" "}
                            <span className="tabular-nums font-medium">
                              {formatRate(log.rate)}원
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
