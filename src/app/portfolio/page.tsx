"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { PortfolioCard } from "@/components/portfolio/PortfolioCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, TrendingUp, Wallet, PieChart, RefreshCw } from "lucide-react";
import Link from "next/link";
import { formatKRW, formatPercent } from "@/lib/utils";

interface Portfolio {
  id: string;
  name: string;
  currency: string;
  description: string | null;
  isDefault: boolean;
  currentBalance: number;
  avgBuyRate: number;
  totalInvested: number;
  broker: string;
}

interface ExchangeRate {
  currency: string;
  rate: number;
}

export default function PortfolioPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError("");

    try {
      // 포트폴리오와 환율 동시 조회
      const [portfolioRes, rateRes] = await Promise.all([
        fetch("/api/portfolios"),
        fetch("/api/exchange/rates"),
      ]);

      const portfolioData = await portfolioRes.json();
      const rateData = await rateRes.json();

      if (!portfolioRes.ok) {
        throw new Error(portfolioData.error);
      }

      setPortfolios(portfolioData.portfolios || []);
      setRates(rateData.rates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 현재 환율 적용
  const getRate = (currency: string) => {
    return rates.find((r) => r.currency === currency)?.rate || 0;
  };

  // 포트폴리오에 현재 환율 추가
  const portfoliosWithRate = portfolios.map((p) => ({
    ...p,
    currentRate: getRate(p.currency) || p.avgBuyRate,
  }));

  // 전체 통계 계산
  const totalAssets = portfoliosWithRate.reduce(
    (sum, p) => sum + p.currentBalance * p.currentRate,
    0
  );
  const totalInvested = portfoliosWithRate.reduce(
    (sum, p) => sum + p.totalInvested,
    0
  );
  const totalProfitLoss = totalAssets - totalInvested;
  const totalProfitPercent =
    totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">포트폴리오</h1>
            <p className="text-muted-foreground">외화 자산을 관리하세요</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              새로고침
            </Button>
            <Button asChild>
              <Link href="/portfolio/new">
                <Plus className="h-4 w-4 mr-2" />
                새 포트폴리오
              </Link>
            </Button>
          </div>
        </div>

        {/* 에러 표시 */}
        {error && (
          <div className="p-4 text-sm text-red-600 bg-red-50 rounded-lg">
            {error}
          </div>
        )}

        {/* 전체 요약 */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">총 평가액</CardTitle>
              <div className="p-2 bg-blue-50 rounded-xl">
                <Wallet className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums text-gray-900">
                {formatKRW(totalAssets)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">투자 원금</CardTitle>
              <div className="p-2 bg-violet-50 rounded-xl">
                <PieChart className="h-4 w-4 text-violet-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums text-gray-900">
                {formatKRW(totalInvested)}
              </div>
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
              <div
                className={`text-2xl font-bold tabular-nums ${
                  totalProfitLoss >= 0 ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {totalProfitLoss >= 0 ? "+" : ""}
                {formatKRW(totalProfitLoss)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">수익률</CardTitle>
              <div className={`p-2 rounded-xl ${totalProfitPercent >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                <TrendingUp className={`h-4 w-4 ${totalProfitPercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold tabular-nums ${
                  totalProfitPercent >= 0 ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {formatPercent(totalProfitPercent)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 포트폴리오 목록 */}
        <div>
          <h2 className="text-lg font-semibold mb-4">내 포트폴리오</h2>

          {loading ? (
            // 로딩 스켈레톤
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="pb-3">
                    <div className="h-6 bg-gray-200 rounded w-32" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="h-8 bg-gray-200 rounded w-40" />
                    <div className="h-20 bg-gray-200 rounded" />
                    <div className="h-10 bg-gray-200 rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : portfolios.length === 0 ? (
            // 빈 상태
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">포트폴리오가 없습니다</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  새 포트폴리오를 만들어 외화 투자를 시작하세요.
                </p>
                <Button asChild>
                  <Link href="/portfolio/new">
                    <Plus className="h-4 w-4 mr-2" />
                    첫 포트폴리오 만들기
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            // 포트폴리오 그리드
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {portfoliosWithRate.map((portfolio) => (
                <PortfolioCard key={portfolio.id} {...portfolio} />
              ))}

              {/* 새 포트폴리오 추가 카드 */}
              <Card className="border-dashed hover:border-primary/50 transition-colors">
                <Link href="/portfolio/new" className="block h-full">
                  <CardContent className="flex flex-col items-center justify-center h-full min-h-[300px] text-muted-foreground">
                    <Plus className="h-12 w-12 mb-4" />
                    <p className="font-medium">새 포트폴리오 추가</p>
                  </CardContent>
                </Link>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
