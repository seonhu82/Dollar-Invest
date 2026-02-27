"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { RateCard } from "@/components/exchange/RateCard";
import { PortfolioCard } from "@/components/portfolio/PortfolioCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  TrendingUp,
  Wallet,
  Bell,
  Plus,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

interface ExchangeRate {
  currency: string;
  currencyName: string;
  rate: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  timestamp: string;
}

interface Portfolio {
  id: string;
  name: string;
  currency: string;
  currentBalance: number;
  avgBuyRate: number;
  totalInvested: number;
  totalRealizedPnl: number;
  currentRate: number;
  broker: string;
}

interface Alert {
  id: string;
  isActive: boolean;
}

export default function DashboardPage() {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [activeAlertCount, setActiveAlertCount] = useState(0);

  const fetchRates = async () => {
    setLoading(true);
    try {
      const currencies = ["USD", "EUR", "GBP", "JPY", "CNY"];
      const results = await Promise.all(
        currencies.map(async (cur) => {
          const res = await fetch(`/api/exchange/history?currency=${cur}&days=7`);
          const data = await res.json();
          if (!data.history || data.history.length < 2) return null;
          const hist: { date: string; rate: number }[] = data.history;
          const current = hist[hist.length - 1];
          const prev = hist[hist.length - 2];
          const allRates = hist.map((h) => h.rate);
          return {
            currency: cur,
            currencyName: "KRW",
            rate: current.rate,
            change: current.rate - prev.rate,
            changePercent: ((current.rate - prev.rate) / prev.rate) * 100,
            high: Math.max(...allRates),
            low: Math.min(...allRates),
            timestamp: current.date,
          };
        })
      );
      const valid = results.filter((r): r is ExchangeRate => r !== null);
      if (valid.length > 0) {
        setRates(valid);
      }
    } catch (error) {
      console.error("Failed to fetch rates:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPortfolios = async () => {
    try {
      const res = await fetch("/api/portfolios");
      const data = await res.json();
      if (data.portfolios) {
        setPortfolios(data.portfolios);
      }
    } catch (error) {
      console.error("Failed to fetch portfolios:", error);
    }
  };

  const fetchAlerts = async () => {
    try {
      const res = await fetch("/api/alerts");
      const data = await res.json();
      if (data.alerts) {
        setActiveAlertCount(data.alerts.filter((a: Alert) => a.isActive).length);
      }
    } catch {
      // 알림 조회 실패 시 무시
    }
  };

  useEffect(() => {
    fetchRates();
    fetchPortfolios();
    fetchAlerts();
    // 1분마다 자동 새로고침
    const interval = setInterval(fetchRates, 60000);
    return () => clearInterval(interval);
  }, []);

  // 포트폴리오에 현재 환율 적용
  const portfoliosWithCurrentRate = portfolios.map((p) => {
    const currentRate = rates.find((r) => r.currency === p.currency)?.rate || p.avgBuyRate;
    return { ...p, currentRate };
  });

  // 총 자산 계산
  const totalAssets = portfoliosWithCurrentRate.reduce((sum, p) => {
    return sum + p.currentBalance * p.currentRate;
  }, 0);

  const totalInvested = portfoliosWithCurrentRate.reduce((sum, p) => {
    return sum + p.totalInvested;
  }, 0);

  const totalProfitLoss = totalAssets - totalInvested;
  const totalProfitPercent =
    totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;

  // 달러 유로 파운드 엔화 위안 순으로 표시
  const currencyOrder = ["USD", "EUR", "GBP", "JPY", "CNY"];
  const mainRates = currencyOrder
    .map((cur) => rates.find((r) => r.currency === cur))
    .filter((r): r is ExchangeRate => r !== null);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* 환영 메시지 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">안녕하세요!</h1>
            <p className="text-muted-foreground">
              오늘의 달러 투자 현황을 확인하세요.
            </p>
          </div>
          <Button asChild>
            <Link href="/trade/buy">
              <Plus className="h-4 w-4 mr-2" />
              새 거래
            </Link>
          </Button>
        </div>

        {/* 요약 카드 */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">총 평가액</CardTitle>
              <div className="p-2 bg-blue-50 rounded-xl">
                <DollarSign className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums text-gray-900">
                {new Intl.NumberFormat("ko-KR", {
                  style: "currency",
                  currency: "KRW",
                  maximumFractionDigits: 0,
                }).format(totalAssets)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">전체 자산 평가</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">총 수익/손실</CardTitle>
              <div className={`p-2 rounded-xl ${totalProfitLoss >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                <TrendingUp className={`h-4 w-4 ${totalProfitLoss >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold tabular-nums ${totalProfitLoss >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {totalProfitLoss >= 0 ? "+" : ""}
                {new Intl.NumberFormat("ko-KR", {
                  style: "currency",
                  currency: "KRW",
                  maximumFractionDigits: 0,
                }).format(totalProfitLoss)}
              </div>
              <p className={`text-xs mt-1 ${totalProfitLoss >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {totalProfitLoss >= 0 ? "+" : ""}{totalProfitPercent.toFixed(2)}% 수익률
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">포트폴리오</CardTitle>
              <div className="p-2 bg-violet-50 rounded-xl">
                <Wallet className="h-4 w-4 text-violet-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{portfolios.length}개</div>
              <p className="text-xs text-muted-foreground mt-1">활성 포트폴리오</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">활성 알림</CardTitle>
              <div className="p-2 bg-amber-50 rounded-xl">
                <Bell className="h-4 w-4 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{activeAlertCount}개</div>
              <p className="text-xs text-muted-foreground mt-1">환율 알림 설정됨</p>
            </CardContent>
          </Card>
        </div>

        {/* 실시간 환율 */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">실시간 환율</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchRates}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                {loading ? "업데이트 중..." : "새로고침"}
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/exchange">
                  더보기 <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {mainRates.length > 0 ? (
              mainRates.map((rate) => (
                <RateCard
                  key={rate.currency}
                  currency={rate.currency}
                  currencyName={rate.currencyName}
                  rate={rate.rate}
                  change={rate.change}
                  changePercent={rate.changePercent}
                  high={rate.high}
                  low={rate.low}
                />
              ))
            ) : (
              // 로딩 스켈레톤
              [...Array(5)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="pb-3">
                    <div className="h-6 bg-gray-200 rounded w-20" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-8 bg-gray-200 rounded w-32 mb-2" />
                    <div className="h-4 bg-gray-200 rounded w-24" />
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* 포트폴리오 */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">내 포트폴리오</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/portfolio">
                전체보기 <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
          {portfoliosWithCurrentRate.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {portfoliosWithCurrentRate.map((portfolio) => (
                <PortfolioCard key={portfolio.id} {...portfolio} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">포트폴리오가 없습니다</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  첫 포트폴리오를 만들어보세요.
                </p>
                <Button asChild>
                  <Link href="/portfolio/new">
                    <Plus className="h-4 w-4 mr-2" />
                    포트폴리오 만들기
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
