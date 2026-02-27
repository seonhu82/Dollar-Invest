"use client";

import { Header } from "@/components/layout/Header";
import { RateCard } from "@/components/exchange/RateCard";
import { ExchangeChart } from "@/components/exchange/ExchangeChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useCallback } from "react";
import { formatRate, formatKRW, getDisplayRate, getRateUnit } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  RefreshCw,
  Calculator,
  ArrowUpDown,
  BarChart3,
  Info,
  Check,
  X as XIcon,
} from "lucide-react";

// ========== Types ==========

interface AlertInfo {
  currency: string;
  tier: string;
  tierLabel: string;
  score: number;
}

interface ExchangeRate {
  currency: string;
  rate: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  timestamp: string;
}

interface AlertReport {
  currency: string;
  currencyName: string;
  tier: string;
  tierLabel: string;
  score: number;
  currentRate: number;
  previousClose: number;
  changePercent: number;
  cci: number;
  rsi: number;
  bbUpper: number;
  bbLower: number;
  bbPercent: number;
  ma50: number;
  ma20: number;
  scoreBreakdown: { trend: number; momentum: number; strength: number; volatility: number };
  summary: {
    daysBelow50MA: number;
    low20D: number;
    high20D: number;
    bbWidthPct: number;
    trendDir: string;
    analysis: string;
  };
  config: {
    name: string;
    description: string;
    cciOversold: number;
    cciOverbought: number;
    rsiOversold: number;
    rsiOverbought: number;
  };
}

// ========== Constants ==========

const CURRENCY_INFO: Record<string, { name: string; koreanName: string; flag: string }> = {
  USD: { name: "미국 달러", koreanName: "미국 달러", flag: "\u{1F1FA}\u{1F1F8}" },
  EUR: { name: "유로", koreanName: "유로", flag: "\u{1F1EA}\u{1F1FA}" },
  GBP: { name: "영국 파운드", koreanName: "영국 파운드", flag: "\u{1F1EC}\u{1F1E7}" },
  JPY: { name: "일본 엔", koreanName: "일본 엔", flag: "\u{1F1EF}\u{1F1F5}" },
  CNY: { name: "중국 위안", koreanName: "중국 위안", flag: "\u{1F1E8}\u{1F1F3}" },
  KRW: { name: "한국 원", koreanName: "한국 원", flag: "\u{1F1F0}\u{1F1F7}" },
};

// 달러 유로 파운드 엔화 위안 순
const ALL_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CNY"];

type SignalTier = "STRONG_SELL" | "SELL" | "NEUTRAL" | "WATCH" | "BUY" | "STRONG_BUY";

const TIER_BADGE: Record<SignalTier, string> = {
  STRONG_BUY: "bg-emerald-600 text-white",
  BUY: "bg-amber-500 text-white",
  WATCH: "bg-blue-500 text-white",
  NEUTRAL: "bg-gray-400 text-white",
  SELL: "bg-orange-500 text-white",
  STRONG_SELL: "bg-red-600 text-white",
};

// ========== Page ==========

export default function ExchangePage() {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [alertMap, setAlertMap] = useState<Record<string, AlertInfo>>({});
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [report, setReport] = useState<AlertReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // 환율 계산기 상태
  const [calcAmount, setCalcAmount] = useState("");
  const [calcDirection, setCalcDirection] = useState<"toKRW" | "fromKRW">("toKRW");

  // 차트와 동일한 히스토리 데이터 소스로 환율 카드 표시
  const fetchRates = async () => {
    setLoading(true);
    try {
      const results = await Promise.all(
        ALL_CURRENCIES.map(async (cur) => {
          const res = await fetch(`/api/exchange/history?currency=${cur}&days=7`);
          const data = await res.json();
          if (!data.history || data.history.length < 2) return null;
          const hist: { date: string; rate: number }[] = data.history;
          const current = hist[hist.length - 1];
          const prev = hist[hist.length - 2];
          const allRates = hist.map((h) => h.rate);
          return {
            currency: cur,
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
        setLastUpdated(new Date().toISOString());
      }
    } catch (error) {
      console.error("Failed to fetch rates:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch(`/api/exchange-alert/status?currencies=${ALL_CURRENCIES.join(",")}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.alerts) {
        const map: Record<string, AlertInfo> = {};
        for (const a of data.alerts) {
          map[a.currency] = { currency: a.currency, tier: a.tier, tierLabel: a.tierLabel, score: a.score };
        }
        setAlertMap(map);
      }
    } catch {
      // 실패 시 무시
    }
  }, []);

  const fetchReport = useCallback(async (currency: string) => {
    setReportLoading(true);
    try {
      const res = await fetch(`/api/exchange-alert/report?currency=${currency}`);
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch {
      setReport(null);
    } finally {
      setReportLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRates();
    fetchAlerts();
    const interval = setInterval(fetchRates, 30000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  // 통화 선택 시 리포트도 함께 fetch
  useEffect(() => {
    fetchReport(selectedCurrency);
  }, [selectedCurrency, fetchReport]);

  // 환율 계산
  const calcCurrency = selectedCurrency;
  const selectedRate = rates.find((r) => r.currency === calcCurrency)?.rate || 0;
  const inputAmount = parseFloat(calcAmount) || 0;
  const calculatedAmount = calcAmount
    ? calcDirection === "toKRW"
      ? inputAmount * selectedRate
      : inputAmount / selectedRate
    : 0;

  const fromCurrency = calcDirection === "toKRW" ? calcCurrency : "KRW";
  const toCurrency = calcDirection === "toKRW" ? "KRW" : calcCurrency;
  const fromInfo = CURRENCY_INFO[fromCurrency] || { name: fromCurrency, koreanName: fromCurrency, flag: "" };
  const toInfo = CURRENCY_INFO[toCurrency] || { name: toCurrency, koreanName: toCurrency, flag: "" };

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

        {/* 환율 카드 그리드 - 달러 유로 파운드 엔화 위안 순 */}
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {ALL_CURRENCIES.map((cur) => {
            const rate = rates.find((r) => r.currency === cur);
            if (!rate) return null;
            const info = CURRENCY_INFO[rate.currency];
            return (
              <RateCard
                key={rate.currency}
                currency={rate.currency}
                currencyName="KRW"
                koreanName={info?.koreanName}
                rate={rate.rate}
                change={rate.change}
                changePercent={rate.changePercent}
                high={rate.high}
                low={rate.low}
                alert={alertMap[rate.currency]}
                selected={selectedCurrency === rate.currency}
                onClick={() => setSelectedCurrency(rate.currency)}
              />
            );
          })}
        </div>

        {/* 선택된 통화의 환율 차트 */}
        <ExchangeChart currency={selectedCurrency} key={selectedCurrency} />

        {/* 차트 아래: 기술적 지표 분석 + 종합 판단 */}
        {reportLoading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-32 bg-gray-100 rounded-xl" />
            <div className="h-24 bg-gray-100 rounded-xl" />
          </div>
        ) : report && report.currency === selectedCurrency ? (
          <AnalysisSection report={report} />
        ) : null}

        {/* 환율 계산기 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              환율 계산기
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* 통화 선택 버튼 5개 */}
            <div className="flex gap-2 mb-4">
              {ALL_CURRENCIES.map((cur) => {
                const info = CURRENCY_INFO[cur];
                return (
                  <button
                    key={cur}
                    onClick={() => setSelectedCurrency(cur)}
                    className={cn(
                      "flex-1 py-2 px-1 rounded-lg text-xs sm:text-sm font-medium transition-all border",
                      selectedCurrency === cur
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:bg-gray-50"
                    )}
                  >
                    <span className="block">{info?.flag} {cur}</span>
                    <span className="block text-[10px] opacity-70">{info?.koreanName}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-3">
              {/* FROM */}
              <div className="p-4 border rounded-xl bg-background space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    변환할 화폐
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {fromInfo.flag} {fromCurrency} - {fromInfo.koreanName}
                  </span>
                </div>
                <Input
                  type="number"
                  placeholder="금액 입력"
                  value={calcAmount}
                  onChange={(e) => setCalcAmount(e.target.value)}
                  className="text-2xl font-semibold border-0 p-0 h-auto focus-visible:ring-0 bg-transparent"
                />
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

              {/* TO */}
              <div className="p-4 border rounded-xl bg-secondary/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    변환될 화폐
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {toInfo.flag} {toCurrency} - {toInfo.koreanName}
                  </span>
                </div>
                <div className="text-2xl font-bold tabular-nums min-h-[36px]">
                  {formattedResult}
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
      </main>
    </div>
  );
}

// ========== 기술적 지표 분석 + 종합 판단 섹션 ==========

function AnalysisSection({ report }: { report: AlertReport }) {
  const signals = deriveSignals(report);
  const rateUnit = getRateUnit(report.currency);

  return (
    <div className="space-y-6">
      {/* 기술적 지표 분석 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4 text-gray-500" />
            {CURRENCY_INFO[report.currency]?.koreanName || report.currency} 기술적 지표 분석
            <span className={cn(
              "ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold",
              TIER_BADGE[report.tier as SignalTier] || "bg-gray-400 text-white"
            )}>
              {report.tierLabel} ({report.score > 0 ? "+" : ""}{report.score}점)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">지표</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">현재값</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">판정</th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 w-12">매수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {signals.map((sig) => (
                  <tr key={sig.label} className="hover:bg-gray-50/50">
                    <td className="px-3 py-2.5 font-medium text-gray-700 text-xs">{sig.label}</td>
                    <td className="px-3 py-2.5 text-xs tabular-nums text-gray-600">{sig.value}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">{sig.signal}</td>
                    <td className="px-3 py-2.5 text-center">
                      {sig.passed ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100">
                          <Check className="h-3 w-3 text-emerald-600" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100">
                          <XIcon className="h-3 w-3 text-gray-400" />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 종합 판단 */}
      {report.summary && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Info className="h-4 w-4 text-gray-500" />
              종합 판단
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-[11px] text-gray-500">MA50 상회</p>
                  <p className="text-lg font-bold tabular-nums text-gray-800">{20 - report.summary.daysBelow50MA}일</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-[11px] text-gray-500">MA50 하회</p>
                  <p className="text-lg font-bold tabular-nums text-gray-800">{report.summary.daysBelow50MA}일</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-[11px] text-gray-500">20일 저점</p>
                  <p className="text-lg font-bold tabular-nums text-blue-600">
                    {formatRate(getDisplayRate(report.currency, report.summary.low20D))}
                  </p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-[11px] text-gray-500">20일 고점</p>
                  <p className="text-lg font-bold tabular-nums text-red-500">
                    {formatRate(getDisplayRate(report.currency, report.summary.high20D))}
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-3">
                <div className="flex items-center gap-2 mb-2 text-xs">
                  <span className="font-medium text-gray-500">추세</span>
                  <span className="font-semibold text-gray-700">{report.summary.trendDir}</span>
                  <span className="text-gray-300">|</span>
                  <span className="font-medium text-gray-500">BB 폭</span>
                  <span className="font-semibold text-gray-700">{report.summary.bbWidthPct.toFixed(2)}%</span>
                  <span className="text-gray-300">|</span>
                  <span className="font-medium text-gray-500">단위</span>
                  <span className="font-semibold text-gray-700">{rateUnit}/KRW</span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {report.summary.analysis}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ========== 지표 신호 도출 ==========

function deriveSignals(report: AlertReport) {
  const { cci, rsi, bbPercent, currentRate, ma50, ma20, scoreBreakdown, config } = report;
  const pctFromMA = ma50 > 0 ? ((currentRate - ma50) / ma50) * 100 : 0;

  return [
    {
      label: "추세 (MA50)",
      value: `${pctFromMA >= 0 ? "+" : ""}${pctFromMA.toFixed(2)}%`,
      signal: currentRate < ma50 ? "MA50 하회 (매수 유리)" : "MA50 상회 (매도 유리)",
      passed: scoreBreakdown.trend > 0,
    },
    {
      label: "CCI(20)",
      value: cci.toFixed(1),
      signal:
        cci <= config.cciOversold ? "과매도 영역" :
        cci >= config.cciOverbought ? "과매수 영역" : "중립 영역",
      passed: scoreBreakdown.momentum > 0,
    },
    {
      label: "RSI(14)",
      value: rsi.toFixed(1),
      signal:
        rsi <= config.rsiOversold ? "과매도 영역" :
        rsi >= config.rsiOverbought ? "과매수 영역" : "중립 영역",
      passed: scoreBreakdown.strength > 0,
    },
    {
      label: "BB %B(20,2)",
      value: `${(bbPercent * 100).toFixed(1)}%`,
      signal:
        bbPercent <= 0.2 ? "하단 근접 (과매도)" :
        bbPercent >= 0.8 ? "상단 근접 (과매수)" : "중간 영역",
      passed: scoreBreakdown.volatility > 0,
    },
    {
      label: "MA 크로스",
      value: `MA20 ${formatRate(getDisplayRate(report.currency, ma20))}`,
      signal: ma20 < ma50 ? "데드크로스 (하락추세)" : "골든크로스 (상승추세)",
      passed: ma20 < ma50,
    },
  ];
}
