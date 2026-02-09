"use client";

import { Header } from "@/components/layout/Header";
import { RateCard } from "@/components/exchange/RateCard";
import { ExchangeChart } from "@/components/exchange/ExchangeChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { formatRate, formatKRW } from "@/lib/utils";
import { RefreshCw, Calculator, ArrowRightLeft } from "lucide-react";

interface ExchangeRate {
  currency: string;
  rate: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  timestamp: string;
}

export default function ExchangePage() {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  // 환율 계산기 상태
  const [calcCurrency, setCalcCurrency] = useState("USD");
  const [calcAmount, setCalcAmount] = useState("");
  const [calcDirection, setCalcDirection] = useState<"toKRW" | "fromKRW">("toKRW");

  const fetchRates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/exchange/rates");
      const data = await res.json();
      if (data.rates) {
        setRates(data.rates);
        setLastUpdated(data.updatedAt);
      }
    } catch (error) {
      console.error("Failed to fetch rates:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
    // 30초마다 자동 새로고침
    const interval = setInterval(fetchRates, 30000);
    return () => clearInterval(interval);
  }, []);

  // 환율 계산
  const selectedRate = rates.find((r) => r.currency === calcCurrency)?.rate || 0;
  const calculatedAmount = calcAmount
    ? calcDirection === "toKRW"
      ? parseFloat(calcAmount) * selectedRate
      : parseFloat(calcAmount) / selectedRate
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">환율 정보</h1>
            <p className="text-muted-foreground">
              실시간 환율 정보를 확인하세요
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {lastUpdated && `마지막 업데이트: ${new Date(lastUpdated).toLocaleTimeString("ko-KR")}`}
            </span>
            <Button variant="outline" size="sm" onClick={fetchRates} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              새로고침
            </Button>
          </div>
        </div>

        {/* 환율 카드 그리드 */}
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {rates.map((rate) => (
            <RateCard
              key={rate.currency}
              currency={rate.currency}
              currencyName="KRW"
              rate={rate.rate}
              change={rate.change}
              changePercent={rate.changePercent}
              high={rate.high}
              low={rate.low}
            />
          ))}
        </div>

        {/* 환율 계산기 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              환율 계산기
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center gap-4">
              {/* 입력 */}
              <div className="flex-1 w-full">
                <label className="text-sm text-muted-foreground mb-2 block">
                  {calcDirection === "toKRW" ? "외화 금액" : "원화 금액"}
                </label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="금액 입력"
                    value={calcAmount}
                    onChange={(e) => setCalcAmount(e.target.value)}
                    className="text-lg"
                  />
                  <select
                    value={calcCurrency}
                    onChange={(e) => setCalcCurrency(e.target.value)}
                    className="px-3 py-2 border rounded-md bg-background"
                  >
                    {rates.map((rate) => (
                      <option key={rate.currency} value={rate.currency}>
                        {rate.currency}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 방향 전환 버튼 */}
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setCalcDirection((d) => (d === "toKRW" ? "fromKRW" : "toKRW"))
                }
                className="shrink-0"
              >
                <ArrowRightLeft className="h-4 w-4" />
              </Button>

              {/* 결과 */}
              <div className="flex-1 w-full">
                <label className="text-sm text-muted-foreground mb-2 block">
                  {calcDirection === "toKRW" ? "원화 금액" : "외화 금액"}
                </label>
                <div className="px-4 py-3 bg-secondary rounded-md">
                  <span className="text-2xl font-bold tabular-nums">
                    {calcDirection === "toKRW"
                      ? formatKRW(calculatedAmount)
                      : `${calculatedAmount.toFixed(2)} ${calcCurrency}`}
                  </span>
                </div>
              </div>
            </div>

            {/* 적용 환율 표시 */}
            <div className="mt-4 text-sm text-muted-foreground text-center">
              적용 환율: 1 {calcCurrency} = {formatRate(selectedRate)} KRW
            </div>
          </CardContent>
        </Card>

        {/* USD/KRW 환율 차트 */}
        <ExchangeChart currency="USD" />
      </main>
    </div>
  );
}
