"use client";

import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatKRW, formatRate, formatCurrency, formatDateTime, getDisplayRate, getInternalRate, getRateUnit } from "@/lib/utils";
import { ArrowLeft, AlertCircle, Check, RefreshCw } from "lucide-react";
import Link from "next/link";

interface Portfolio {
  id: string;
  name: string;
  currency: string;
  currentBalance: number;
  avgBuyRate: number;
}

interface ExchangeRate {
  currency: string;
  rate: number;
}

interface BuyTransaction {
  id: string;
  amount: number;
  rate: number;
  tradedAt: string;
  memo: string | null;
}

const RATE_REFRESH_INTERVAL = 30 * 1000; // 30초

function SellForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPortfolioId = searchParams.get("portfolio");

  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);

  const [portfolioId, setPortfolioId] = useState(preselectedPortfolioId || "");
  const [amount, setAmount] = useState("");
  const [krwInput, setKrwInput] = useState("");
  const [inputMode, setInputMode] = useState<"currency" | "krw">("currency");
  const [customRate, setCustomRate] = useState("");
  const [useCustomRate, setUseCustomRate] = useState(false);
  const [fee, setFee] = useState("");
  const [memo, setMemo] = useState("");
  const [tradedAt, setTradedAt] = useState(new Date().toISOString().split("T")[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // 진입가 관련 상태
  const [entryRateTab, setEntryRateTab] = useState<"none" | "select" | "manual">("none");
  const [buyTransactions, setBuyTransactions] = useState<BuyTransaction[]>([]);
  const [selectedBuyId, setSelectedBuyId] = useState<string | null>(null);
  const [manualEntryRate, setManualEntryRate] = useState("");
  const [loadingBuys, setLoadingBuys] = useState(false);

  // 실시간 환율 관련
  const [rateUpdatedAt, setRateUpdatedAt] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRates = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    try {
      const rateRes = await fetch("/api/exchange/rates?realtime=true");
      const rateData = await rateRes.json();
      if (rateData.rates) {
        setRates(rateData.rates);
        setRateUpdatedAt(new Date());
      }
    } catch {
      // 조용히 실패 (이전 데이터 유지)
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [portfolioRes, rateRes] = await Promise.all([
          fetch("/api/portfolios"),
          fetch("/api/exchange/rates?realtime=true"),
        ]);

        const portfolioData = await portfolioRes.json();
        const rateData = await rateRes.json();

        const portfoliosWithBalance = (portfolioData.portfolios || []).filter(
          (p: Portfolio) => p.currentBalance > 0
        );

        setPortfolios(portfoliosWithBalance);
        setRates(rateData.rates || []);
        setRateUpdatedAt(new Date());

        if (!preselectedPortfolioId && portfoliosWithBalance.length > 0) {
          setPortfolioId(portfoliosWithBalance[0].id);
        }
      } catch (err) {
        setError("데이터를 불러오는데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [preselectedPortfolioId]);

  // 포트폴리오 변경 시 매수 내역 로드
  useEffect(() => {
    if (!portfolioId) return;
    setSelectedBuyId(null);
    setManualEntryRate("");

    if (entryRateTab === "select") {
      fetchBuyTransactions();
    }
  }, [portfolioId]);

  // 탭 변경 시 매수 내역 로드
  useEffect(() => {
    if (entryRateTab === "select" && portfolioId && buyTransactions.length === 0) {
      fetchBuyTransactions();
    }
    if (entryRateTab === "none") {
      setSelectedBuyId(null);
      setManualEntryRate("");
    }
    if (entryRateTab === "manual") {
      setSelectedBuyId(null);
    }
    if (entryRateTab === "select") {
      setManualEntryRate("");
    }
  }, [entryRateTab]);

  const fetchBuyTransactions = async () => {
    setLoadingBuys(true);
    try {
      const res = await fetch(`/api/transactions?portfolioId=${portfolioId}&type=BUY&limit=100`);
      const data = await res.json();
      setBuyTransactions(data.transactions || []);
    } catch {
      // 실패 시 빈 목록
    } finally {
      setLoadingBuys(false);
    }
  };

  // 30초마다 환율 자동 갱신
  useEffect(() => {
    refreshTimerRef.current = setInterval(() => {
      fetchRates();
    }, RATE_REFRESH_INTERVAL);

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [fetchRates]);

  const selectedPortfolio = portfolios.find((p) => p.id === portfolioId);
  const currency = selectedPortfolio?.currency || "USD";
  const balance = selectedPortfolio?.currentBalance || 0;
  const avgBuyRate = selectedPortfolio?.avgBuyRate || 0;
  const currentRate = rates.find((r) => r.currency === currency)?.rate || 0;
  // 사용자 입력 환율은 표시 단위(JPY: 100엔당)로 입력 → 내부 단위(1엔당)로 변환
  const effectiveRate = useCustomRate
    ? getInternalRate(currency, parseFloat(customRate) || 0)
    : currentRate;

  const feeNum = parseFloat(fee) || 0;

  // 입력 모드에 따라 외화 금액 / 원화 금액 계산
  let amountNum: number;
  let krwAmount: number;
  if (inputMode === "currency") {
    amountNum = parseFloat(amount) || 0;
    krwAmount = amountNum * effectiveRate;
  } else {
    const krwInputNum = parseFloat(krwInput) || 0;
    krwAmount = krwInputNum;
    amountNum = effectiveRate > 0 ? krwInputNum / effectiveRate : 0;
  }
  const totalKrw = krwAmount - feeNum;

  // 진입가 결정
  const selectedBuy = buyTransactions.find((b) => b.id === selectedBuyId);
  const resolvedEntryRate =
    entryRateTab === "select" && selectedBuy
      ? selectedBuy.rate
      : entryRateTab === "manual" && manualEntryRate
        ? getInternalRate(currency, parseFloat(manualEntryRate) || 0)
        : null;

  // 손익 계산: 진입가 있으면 진입가 기반, 없으면 평균단가 기반
  const entryRateForCalc = resolvedEntryRate ?? avgBuyRate;
  const costBasis = amountNum * entryRateForCalc;
  const profitLoss = krwAmount - costBasis;
  const profitPercent = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0;

  const handleSellAll = () => {
    if (inputMode === "krw") {
      // 원화 모드에서는 외화 모드로 전환 후 전량 입력
      setInputMode("currency");
      setKrwInput("");
    }
    setAmount(balance.toString());
  };

  const handleRefreshRate = () => {
    fetchRates(true);
  };

  const handleSubmit = async () => {
    if (!portfolioId || amountNum <= 0 || effectiveRate <= 0) return;

    if (amountNum > balance) {
      setError("보유량보다 많은 금액을 매도할 수 없습니다.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      // 제출 직전 최신 환율 확인 (캐시 무시)
      if (!useCustomRate) {
        const freshRes = await fetch("/api/exchange/rates?realtime=true");
        const freshData = await freshRes.json();
        const freshRate = freshData.rates?.find(
          (r: ExchangeRate) => r.currency === currency
        )?.rate;

        if (freshRate && Math.abs(freshRate - effectiveRate) > effectiveRate * 0.005) {
          // 0.5% 이상 변동 시 경고 후 새 환율 적용
          setRates(freshData.rates);
          setRateUpdatedAt(new Date());
          setError(
            `환율이 변동되었습니다 (${formatRate(getDisplayRate(currency, effectiveRate))} → ${formatRate(getDisplayRate(currency, freshRate))}원/${getRateUnit(currency)}). 새 환율을 확인 후 다시 시도해주세요.`
          );
          setIsSubmitting(false);
          return;
        }

        if (freshRate) {
          setRates(freshData.rates);
          setRateUpdatedAt(new Date());
        }
      }

      const submitRate = useCustomRate ? effectiveRate : (rates.find((r) => r.currency === currency)?.rate || effectiveRate);

      // 진입가/매수건 연결 정보
      const submitBody: Record<string, unknown> = {
        portfolioId,
        type: "SELL",
        amount: amountNum,
        rate: submitRate,
        fee: feeNum,
        memo: memo || undefined,
        tradedAt: new Date(tradedAt).toISOString(),
      };

      if (entryRateTab === "select" && selectedBuyId) {
        submitBody.linkedBuyId = selectedBuyId;
      } else if (entryRateTab === "manual" && manualEntryRate) {
        submitBody.entryRate = getInternalRate(currency, parseFloat(manualEntryRate));
      }

      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitBody),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "거래 등록에 실패했습니다.");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(`/portfolio/${portfolioId}`);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 bg-gray-200 rounded w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
        </CardContent>
      </Card>
    );
  }

  if (success) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2">매도 완료!</h3>
          <p className="text-muted-foreground">
            {amountNum.toLocaleString()} {currency} 매도가 기록되었습니다.
          </p>
          {profitLoss !== 0 && (
            <p className={`mt-2 font-medium ${profitLoss >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              실현 손익: {profitLoss >= 0 ? "+" : ""}{formatKRW(profitLoss)}
              {resolvedEntryRate ? " (진입가 기준)" : " (평균단가 기준)"}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-blue-600">외화 매도</CardTitle>
        <CardDescription>보유 외화를 원화로 매도합니다</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
            {error}
          </div>
        )}

        <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-yellow-800">수동 입력 모드</p>
            <p className="text-yellow-700">
              거래 기록만 저장됩니다. 실제 매도는 증권사 앱에서 직접 진행해주세요.
            </p>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">포트폴리오</label>
          {portfolios.length === 0 ? (
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-2">
                매도 가능한 포트폴리오가 없습니다.
              </p>
              <Button size="sm" asChild>
                <Link href="/trade/buy">먼저 매수하기</Link>
              </Button>
            </div>
          ) : (
            <select
              value={portfolioId}
              onChange={(e) => setPortfolioId(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background"
            >
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} - {formatCurrency(p.currentBalance, p.currency)} 보유
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedPortfolio && (
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-blue-600 mb-1">보유량</p>
                <p className="text-xl font-bold text-blue-900 tabular-nums">
                  {formatCurrency(balance, currency)}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSellAll}
                className="text-blue-600 border-blue-200 hover:bg-blue-100"
              >
                전량 매도
              </Button>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              평균 매수가: {formatRate(getDisplayRate(currency, avgBuyRate))}원/{getRateUnit(currency)}
            </p>
          </div>
        )}

        <div>
          <label className="text-sm font-medium mb-2 block">매도 금액</label>
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-3">
            <button
              type="button"
              onClick={() => { setInputMode("currency"); setKrwInput(""); }}
              className={`flex-1 text-xs py-1.5 px-3 rounded-md transition-colors ${
                inputMode === "currency"
                  ? "bg-white shadow-sm font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {currency} 금액 입력
            </button>
            <button
              type="button"
              onClick={() => { setInputMode("krw"); setAmount(""); }}
              className={`flex-1 text-xs py-1.5 px-3 rounded-md transition-colors ${
                inputMode === "krw"
                  ? "bg-white shadow-sm font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              원화 금액 입력
            </button>
          </div>
          {inputMode === "currency" ? (
            <div className="relative">
              <Input
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-2xl h-14 pr-16"
                step="0.01"
                max={balance}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                {currency}
              </span>
            </div>
          ) : (
            <div className="relative">
              <Input
                type="number"
                placeholder="0"
                value={krwInput}
                onChange={(e) => setKrwInput(e.target.value)}
                className="text-2xl h-14 pr-12"
                step="1"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                원
              </span>
            </div>
          )}
          {/* 역산된 값 표시 */}
          {inputMode === "krw" && amountNum > 0 && effectiveRate > 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              = <span className="font-medium tabular-nums">{amountNum.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span> {currency}
            </p>
          )}
          {inputMode === "currency" && amountNum > 0 && effectiveRate > 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              = <span className="font-medium tabular-nums">{formatKRW(krwAmount)}</span>
            </p>
          )}
          {amountNum > balance && (
            <p className="text-xs text-red-600 mt-1">보유량을 초과했습니다.</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">적용 환율</label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useCustomRate}
                onChange={(e) => setUseCustomRate(e.target.checked)}
                className="rounded"
              />
              직접 입력
            </label>
          </div>
          {useCustomRate ? (
            <div className="relative">
              <Input
                type="number"
                placeholder="환율 입력"
                value={customRate}
                onChange={(e) => setCustomRate(e.target.value)}
                className="pr-20"
                step="0.01"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                원/{getRateUnit(currency)}
              </span>
            </div>
          ) : (
            <div className="p-3 bg-secondary rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <span className="text-sm">
                    실시간 환율:{" "}
                    <strong className="tabular-nums text-base">{formatRate(getDisplayRate(currency, currentRate))}</strong>{" "}
                    원/{getRateUnit(currency)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefreshRate}
                  disabled={isRefreshing}
                  className="h-7 px-2"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                </Button>
              </div>
              {rateUpdatedAt && (
                <p className="text-xs text-muted-foreground mt-1 ml-4.5">
                  {rateUpdatedAt.toLocaleTimeString("ko-KR")} 기준 (30초마다 자동 갱신)
                </p>
              )}
            </div>
          )}
        </div>

        {/* 진입가 설정 (선택사항) */}
        {selectedPortfolio && (
          <div>
            <label className="text-sm font-medium mb-2 block">진입가 설정 (선택사항)</label>
            <p className="text-xs text-muted-foreground mb-3">
              매수건을 연결하거나 진입가를 입력하면 개별 실현손익을 추적할 수 있습니다.
            </p>

            {/* 탭 선택 */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-3">
              <button
                type="button"
                onClick={() => setEntryRateTab("none")}
                className={`flex-1 text-xs py-1.5 px-3 rounded-md transition-colors ${
                  entryRateTab === "none"
                    ? "bg-white shadow-sm font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                설정 안함
              </button>
              <button
                type="button"
                onClick={() => setEntryRateTab("select")}
                className={`flex-1 text-xs py-1.5 px-3 rounded-md transition-colors ${
                  entryRateTab === "select"
                    ? "bg-white shadow-sm font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                매수 내역 선택
              </button>
              <button
                type="button"
                onClick={() => setEntryRateTab("manual")}
                className={`flex-1 text-xs py-1.5 px-3 rounded-md transition-colors ${
                  entryRateTab === "manual"
                    ? "bg-white shadow-sm font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                직접 입력
              </button>
            </div>

            {/* 매수 내역 선택 */}
            {entryRateTab === "select" && (
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                {loadingBuys ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    매수 내역 로딩 중...
                  </div>
                ) : buyTransactions.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    매수 내역이 없습니다.
                  </div>
                ) : (
                  buyTransactions.map((buy) => (
                    <button
                      key={buy.id}
                      type="button"
                      onClick={() => setSelectedBuyId(selectedBuyId === buy.id ? null : buy.id)}
                      className={`w-full text-left px-3 py-2.5 border-b last:border-0 text-sm transition-colors ${
                        selectedBuyId === buy.id
                          ? "bg-blue-50 border-l-2 border-l-blue-500"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-medium tabular-nums">
                            {formatCurrency(buy.amount, currency)}
                          </span>
                          <span className="text-muted-foreground mx-1">@</span>
                          <span className="tabular-nums">
                            {formatRate(getDisplayRate(currency, buy.rate))}원/{getRateUnit(currency)}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(buy.tradedAt)}
                        </span>
                      </div>
                      {buy.memo && (
                        <p className="text-xs text-muted-foreground mt-0.5">{buy.memo}</p>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}

            {/* 진입가 직접 입력 */}
            {entryRateTab === "manual" && (
              <div className="relative">
                <Input
                  type="number"
                  placeholder="진입가 입력"
                  value={manualEntryRate}
                  onChange={(e) => setManualEntryRate(e.target.value)}
                  className="pr-20"
                  step="0.01"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  원/{getRateUnit(currency)}
                </span>
              </div>
            )}

            {/* 선택된 진입가 표시 */}
            {resolvedEntryRate !== null && (
              <div className="mt-2 text-xs text-blue-600">
                진입가: {formatRate(getDisplayRate(currency, resolvedEntryRate))}원/{getRateUnit(currency)}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="text-sm font-medium mb-2 block">수수료 (선택)</label>
          <div className="relative">
            <Input
              type="number"
              placeholder="0"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              className="pr-12"
              step="1"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              원
            </span>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">거래일</label>
          <Input
            type="date"
            value={tradedAt}
            onChange={(e) => setTradedAt(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
          />
        </div>

        {amountNum > 0 && effectiveRate > 0 && (
          <div className="space-y-3 p-4 border rounded-lg">
            <div className="flex justify-between">
              <span className="text-muted-foreground">매도 금액</span>
              <span className="tabular-nums">{formatKRW(krwAmount)}</span>
            </div>
            {feeNum > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">수수료</span>
                <span className="tabular-nums">-{formatKRW(feeNum)}</span>
              </div>
            )}
            <hr />
            <div className="flex justify-between font-semibold">
              <span>수령 예상 금액</span>
              <span className="tabular-nums text-blue-600">{formatKRW(totalKrw)}</span>
            </div>
            {entryRateForCalc > 0 && (
              <>
                <hr />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    예상 실현 손익
                    <span className="text-xs ml-1">
                      ({resolvedEntryRate ? "진입가" : "평균단가"} 기준)
                    </span>
                  </span>
                  <span
                    className={`tabular-nums font-medium ${
                      profitLoss >= 0 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {profitLoss >= 0 ? "+" : ""}
                    {formatKRW(profitLoss)} ({profitLoss >= 0 ? "+" : ""}
                    {profitPercent.toFixed(2)}%)
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        <div>
          <label className="text-sm font-medium mb-2 block">메모 (선택)</label>
          <Input
            placeholder="거래 메모를 입력하세요"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            maxLength={200}
          />
        </div>

        <Button
          variant="sell"
          size="lg"
          className="w-full"
          disabled={
            !portfolioId ||
            amountNum <= 0 ||
            amountNum > balance ||
            effectiveRate <= 0 ||
            isSubmitting
          }
          onClick={handleSubmit}
        >
          {isSubmitting
            ? "환율 확인 중..."
            : `${amountNum.toLocaleString()} ${currency} 매도 기록`}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function SellPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/trade"
          className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          거래 목록으로
        </Link>

        <Suspense fallback={<div>로딩 중...</div>}>
          <SellForm />
        </Suspense>
      </main>
    </div>
  );
}
