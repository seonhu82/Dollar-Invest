"use client";

import { Header } from "@/components/layout/Header";
import { RateCard } from "@/components/exchange/RateCard";
import { ExchangeChart } from "@/components/exchange/ExchangeChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { formatRate, formatKRW, getDisplayRate, getRateUnit } from "@/lib/utils";
import { RefreshCw, Calculator, ArrowUpDown } from "lucide-react";

interface ExchangeRate {
  currency: string;
  rate: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  timestamp: string;
}

const CURRENCY_INFO: Record<string, { name: string; flag: string }> = {
  USD: { name: "미국 달러", flag: "\u{1F1FA}\u{1F1F8}" },
  EUR: { name: "유로", flag: "\u{1F1EA}\u{1F1FA}" },
  JPY: { name: "일본 엔", flag: "\u{1F1EF}\u{1F1F5}" },
  CNY: { name: "중국 위안", flag: "\u{1F1E8}\u{1F1F3}" },
  GBP: { name: "영국 파운드", flag: "\u{1F1EC}\u{1F1E7}" },
  KRW: { name: "한국 원", flag: "\u{1F1F0}\u{1F1F7}" },
};

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
      const res = await fetch("/api/exchange/rates?realtime=true");
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
  const inputAmount = parseFloat(calcAmount) || 0;
  const calculatedAmount = calcAmount
    ? calcDirection === "toKRW"
      ? inputAmount * selectedRate
      : inputAmount / selectedRate
    : 0;

  // FROM/TO 통화 결정
  const fromCurrency = calcDirection === "toKRW" ? calcCurrency : "KRW";
  const toCurrency = calcDirection === "toKRW" ? "KRW" : calcCurrency;
  const fromInfo = CURRENCY_INFO[fromCurrency] || { name: fromCurrency, flag: "" };
  const toInfo = CURRENCY_INFO[toCurrency] || { name: toCurrency, flag: "" };

  // 스왑: 방향 전환 + 결과값을 입력값으로 이동
  const handleSwap = () => {
    if (calculatedAmount > 0) {
      const newAmount =
        calcDirection === "toKRW"
          ? Math.round(calculatedAmount).toString()
          : calculatedAmount.toFixed(2);
      setCalcAmount(newAmount);
    }
    setCalcDirection((d) => (d === "toKRW" ? "fromKRW" : "toKRW"));
  };

  // 결과 포맷팅
  const formattedResult =
    calcAmount && calculatedAmount > 0
      ? calcDirection === "toKRW"
        ? formatKRW(calculatedAmount)
        : calculatedAmount.toFixed(2)
      : "0";

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">환율 정보</h1>
            <p className="text-sm text-muted-foreground">
              실시간 환율 정보를 확인하세요
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs sm:text-sm text-muted-foreground">
              {lastUpdated && new Date(lastUpdated).toLocaleTimeString("ko-KR") + " 기준"}
            </span>
            <Button variant="outline" size="sm" onClick={fetchRates} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">새로고침</span>
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
            <div className="flex flex-col gap-3">
              {/* FROM - 변환할 금액 */}
              <div className="p-4 border rounded-xl bg-background space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    변환할 화폐
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {fromInfo.flag} {fromCurrency}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    placeholder="금액 입력"
                    value={calcAmount}
                    onChange={(e) => setCalcAmount(e.target.value)}
                    className="text-2xl font-semibold border-0 p-0 h-auto focus-visible:ring-0 bg-transparent flex-1"
                  />
                  {calcDirection === "toKRW" ? (
                    <select
                      value={calcCurrency}
                      onChange={(e) => setCalcCurrency(e.target.value)}
                      className="px-3 py-2 border rounded-lg bg-secondary text-sm font-medium min-w-[140px]"
                    >
                      {rates.map((rate) => {
                        const info = CURRENCY_INFO[rate.currency];
                        return (
                          <option key={rate.currency} value={rate.currency}>
                            {info?.flag} {rate.currency} - {info?.name}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <div className="px-3 py-2 bg-secondary rounded-lg text-sm font-medium min-w-[140px]">
                      {CURRENCY_INFO.KRW.flag} KRW - {CURRENCY_INFO.KRW.name}
                    </div>
                  )}
                </div>
              </div>

              {/* 스왑 버튼 */}
              <div className="flex justify-center -my-1 relative z-10">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleSwap}
                  className="rounded-full h-10 w-10 border-2 bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all shadow-sm"
                  title="통화 교환"
                >
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </div>

              {/* TO - 변환 결과 */}
              <div className="p-4 border rounded-xl bg-secondary/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    변환될 화폐
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {toInfo.flag} {toCurrency}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold tabular-nums flex-1 min-h-[36px]">
                    {formattedResult}
                  </div>
                  {calcDirection === "fromKRW" ? (
                    <select
                      value={calcCurrency}
                      onChange={(e) => setCalcCurrency(e.target.value)}
                      className="px-3 py-2 border rounded-lg bg-secondary text-sm font-medium min-w-[140px]"
                    >
                      {rates.map((rate) => {
                        const info = CURRENCY_INFO[rate.currency];
                        return (
                          <option key={rate.currency} value={rate.currency}>
                            {info?.flag} {rate.currency} - {info?.name}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <div className="px-3 py-2 bg-secondary rounded-lg text-sm font-medium min-w-[140px]">
                      {CURRENCY_INFO.KRW.flag} KRW - {CURRENCY_INFO.KRW.name}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 적용 환율 표시 */}
            <div className="mt-4 pt-4 border-t flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <span>적용 환율:</span>
              <span className="font-medium text-foreground">
                {calcCurrency === "JPY" ? "100" : "1"} {calcCurrency} = {formatRate(getDisplayRate(calcCurrency, selectedRate))} KRW
              </span>
            </div>
          </CardContent>
        </Card>

        {/* USD/KRW 환율 차트 */}
        <ExchangeChart currency="USD" />
      </main>
    </div>
  );
}
