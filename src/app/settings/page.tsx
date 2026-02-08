"use client";

import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { User, Bell, Link2, Shield, Moon, Globe } from "lucide-react";

export default function SettingsPage() {
  const [notifications, setNotifications] = useState({
    rateAlert: true,
    dailyReport: false,
    orderComplete: true,
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">설정</h1>
          <p className="text-muted-foreground">앱 설정을 관리합니다</p>
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
                <Input value="user@example.com" disabled />
              </div>
              <div>
                <label className="text-sm font-medium">이름</label>
                <Input placeholder="이름을 입력하세요" />
              </div>
            </div>
            <Button>저장</Button>
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
              <input
                type="checkbox"
                checked={notifications.rateAlert}
                onChange={(e) => setNotifications({ ...notifications, rateAlert: e.target.checked })}
                className="h-5 w-5"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">일일 리포트</p>
                <p className="text-sm text-muted-foreground">매일 아침 환율 요약</p>
              </div>
              <input
                type="checkbox"
                checked={notifications.dailyReport}
                onChange={(e) => setNotifications({ ...notifications, dailyReport: e.target.checked })}
                className="h-5 w-5"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">주문 완료</p>
                <p className="text-sm text-muted-foreground">주문 체결 시 알림</p>
              </div>
              <input
                type="checkbox"
                checked={notifications.orderComplete}
                onChange={(e) => setNotifications({ ...notifications, orderComplete: e.target.checked })}
                className="h-5 w-5"
              />
            </div>
          </CardContent>
        </Card>

        {/* 연동 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              <CardTitle>증권사 연동</CardTitle>
            </div>
            <CardDescription>증권사 API 연동 상태</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">하나증권</p>
                <p className="text-sm text-muted-foreground">PC 브릿지 연결 필요</p>
              </div>
              <Button variant="outline" asChild>
                <a href="/broker">설정</a>
              </Button>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">한국투자증권</p>
                <p className="text-sm text-muted-foreground">API 키 연동</p>
              </div>
              <Button variant="outline" asChild>
                <a href="/broker">설정</a>
              </Button>
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
