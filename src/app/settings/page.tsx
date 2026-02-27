"use client";

import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { User, Bell, Shield, Globe, Check, Loader2, MonitorUp } from "lucide-react";

const ALL_CURRENCIES = [
  { code: "USD", name: "미국 달러", symbol: "$" },
  { code: "JPY", name: "일본 엔", symbol: "¥" },
  { code: "EUR", name: "유로", symbol: "€" },
  { code: "GBP", name: "영국 파운드", symbol: "£" },
  { code: "CNY", name: "중국 위안", symbol: "¥" },
];

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notifications, setNotifications] = useState({
    rateAlert: true,
    dailyReport: false,
    orderComplete: true,
  });
  const [bannerEnabled, setBannerEnabled] = useState(true);
  const [bannerCurrencies, setBannerCurrencies] = useState<string[]>(
    ALL_CURRENCIES.map((c) => c.code)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // 설정 로드
  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          setName(data.settings.name || "");
          setEmail(data.settings.email || "");
          setNotifications({
            rateAlert: data.settings.notifRateAlert ?? true,
            dailyReport: data.settings.notifDailyReport ?? false,
            orderComplete: data.settings.notifOrderComplete ?? true,
          });
          setBannerEnabled(data.settings.bannerEnabled ?? true);
          if (data.settings.bannerCurrencies) {
            setBannerCurrencies(
              data.settings.bannerCurrencies.split(",").filter(Boolean)
            );
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // 설정 저장
  const handleSave = async (updates: Record<string, unknown>) => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      // 실패 시 무시
    } finally {
      setSaving(false);
    }
  };

  // 알림 토글
  const toggleNotification = (key: keyof typeof notifications) => {
    const newValue = !notifications[key];
    setNotifications({ ...notifications, [key]: newValue });

    const fieldMap = {
      rateAlert: "notifRateAlert",
      dailyReport: "notifDailyReport",
      orderComplete: "notifOrderComplete",
    };
    handleSave({ [fieldMap[key]]: newValue });
  };

  // 배너 활성화 토글
  const toggleBanner = () => {
    const newValue = !bannerEnabled;
    setBannerEnabled(newValue);
    handleSave({ bannerEnabled: newValue });
  };

  // 배너 통화 토글
  const toggleBannerCurrency = (code: string) => {
    const newCurrencies = bannerCurrencies.includes(code)
      ? bannerCurrencies.filter((c) => c !== code)
      : [...bannerCurrencies, code];

    // 최소 1개는 선택해야 함
    if (newCurrencies.length === 0) return;

    setBannerCurrencies(newCurrencies);
    // 순서 유지를 위해 ALL_CURRENCIES 순서대로 정렬
    const ordered = ALL_CURRENCIES
      .map((c) => c.code)
      .filter((c) => newCurrencies.includes(c));
    handleSave({ bannerCurrencies: ordered.join(",") });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">설정</h1>
            <p className="text-muted-foreground">앱 설정을 관리합니다</p>
          </div>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-emerald-600">
              <Check className="h-4 w-4" /> 저장됨
            </span>
          )}
        </div>

        {/* 프로필 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle>프로필</CardTitle>
            </div>
            <CardDescription>계정 정보를 관리합니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">이메일</label>
                <Input value={email} disabled />
              </div>
              <div>
                <label className="text-sm font-medium">이름</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="이름을 입력하세요"
                  disabled={loading}
                />
              </div>
            </div>
            <Button onClick={() => handleSave({ name })} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              저장
            </Button>
          </CardContent>
        </Card>

        {/* 상단 롤링 알림 배너 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MonitorUp className="h-5 w-5" />
              <CardTitle>상단 롤링 알림</CardTitle>
            </div>
            <CardDescription>
              헤더 아래 환율 분석 배너의 표시 여부와 통화를 설정합니다
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* 배너 활성화 토글 */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">배너 표시</p>
                <p className="text-sm text-muted-foreground">
                  상단에 환율 분석 롤링 배너를 표시합니다
                </p>
              </div>
              <button
                onClick={toggleBanner}
                disabled={loading}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  bannerEnabled ? "bg-emerald-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    bannerEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* 통화 선택 체크박스 */}
            <div
              className={`space-y-3 transition-opacity ${
                bannerEnabled ? "opacity-100" : "opacity-40 pointer-events-none"
              }`}
            >
              <p className="text-sm font-medium text-muted-foreground">
                표시할 통화 선택
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {ALL_CURRENCIES.map((cur) => {
                  const isChecked = bannerCurrencies.includes(cur.code);
                  return (
                    <button
                      key={cur.code}
                      onClick={() => toggleBannerCurrency(cur.code)}
                      disabled={loading}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all ${
                        isChecked
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                      }`}
                    >
                      <div
                        className={`flex items-center justify-center w-5 h-5 rounded border-2 transition-colors ${
                          isChecked
                            ? "bg-emerald-500 border-emerald-500"
                            : "border-gray-300 bg-white"
                        }`}
                      >
                        {isChecked && (
                          <Check className="h-3 w-3 text-white" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold w-4 text-center">
                          {cur.symbol}
                        </span>
                        <div className="text-left">
                          <p className="text-xs font-semibold">{cur.code}</p>
                          <p className="text-[10px] leading-tight opacity-70">
                            {cur.name}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                선택한 통화가 순서대로 위로 롤링됩니다 (최소 1개)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 알림 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <CardTitle>알림 설정</CardTitle>
            </div>
            <CardDescription>알림 수신 방법을 설정합니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">환율 알림</p>
                <p className="text-sm text-muted-foreground">설정한 환율에 도달하면 알림</p>
              </div>
              <button
                onClick={() => toggleNotification("rateAlert")}
                disabled={loading}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notifications.rateAlert ? "bg-emerald-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifications.rateAlert ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">일일 리포트</p>
                <p className="text-sm text-muted-foreground">매일 아침 환율 요약</p>
              </div>
              <button
                onClick={() => toggleNotification("dailyReport")}
                disabled={loading}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notifications.dailyReport ? "bg-emerald-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifications.dailyReport ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">거래 완료</p>
                <p className="text-sm text-muted-foreground">거래 기록 시 알림</p>
              </div>
              <button
                onClick={() => toggleNotification("orderComplete")}
                disabled={loading}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notifications.orderComplete ? "bg-emerald-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifications.orderComplete ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* 보안 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <CardTitle>보안</CardTitle>
            </div>
            <CardDescription>계정 보안 설정</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline">비밀번호 변경</Button>
            <Button variant="destructive">계정 삭제</Button>
          </CardContent>
        </Card>

        {/* 앱 정보 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              <CardTitle>앱 정보</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">버전</span>
                <span>1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">개발</span>
                <span>달러인베스트</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
