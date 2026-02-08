"use client";

import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatKRW, formatRate } from "@/lib/utils";
import { ArrowLeft, Info, AlertCircle, Check } from "lucide-react";
import Link from "next/link";

interface Portfolio {
  id: string;
  name: string;
  currency: string;
  currentBalance: number;
}

interface ExchangeRate {
  currency: string;
  rate: number;
}

function BuyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPortfolioId = searchParams.get("portfolio");

  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);

  const [portfolioId, setPortfolioId] = useState(preselectedPortfolioId || "");
  const [amount, setAmount] = useState("");
  const [customRate, setCustomRate] = useState("");
  const [useCustomRate, setUseCustomRate] = useState(false);
  const [fee, setFee] = useState("");
  const [memo, setMemo] = useState("");
  const [tradedAt, setTradedAt] = useState(new Date().toISOString().split("T")[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [portfolioRes, rateRes] = await Promise.all([
        fetch("/api/portfolios"),
        fetch("/api/exchange/rates"),
      ]);

      const portfolioData = await portfolioRes.json();
      const rateData = await rateRes.json();

      setPortfolios(portfolioData.portfolios || []);
      setRates(rateData.rates || []);

      // 첫 번째 포트폴리오 자동 선택
      if (!preselectedPortfolioId && portfolioData.portfolios?.length > 0) {
        setPortfolioId(portfolioData.portfolios[0].id);
      }
    } catch (err) {
      setError("데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const selectedPortfolio = portfolios.find((p) => p.id === portfolioId);
  const currency = selectedPortfolio?.currency || "USD";
  const currentRate = rates.find((r) => r.currency === currency)?.rate || 0;
  const effectiveRate = useCustomRate ? parseFloat(customRate) || 0 : currentRate;

  const amountNum = parseFloat(amount) || 0;
  const feeNum = parseFloat(fee) || 0;
  const krwAmount = amountNum * effectiveRate;
  const totalKrw = krwAmount + feeNum;

  const handleSubmit = async () => {
    if (!portfolioId || amountNum <= 0 || effectiveRate <= 0) return;

    setError("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioId,
          type: "BUY",
          amount: amountNum,
          rate: effectiveRate,
          fee: feeNum,
          memo: memo || undefined,
          tradedAt: new Date(tradedAt).toISOString(),
        }),
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
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-emerald-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2">매수 완료!</h3>
          <p className="text-muted-foreground">
            {amountNum.toLocaleString()} {currency} 매수가 기록되었습니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-red-600">외화 매수</CardTitle>
        <CardDescription>원화로 외화를 매수합니다</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
            {error}
          </div>
        )}

        {/* 수동 입력 알림 */}
        <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-yellow-800">수동 입력 모드</p>
            <p className="text-yellow-700">
              거래 기록만 저장됩니다. 실제 매수는 증권사 앱에서 직접 진행해주세요.
            </p>
          </div>
        </div>

        {/* 포트폴리오 선택 */}
        <div>
          <label className="text-sm font-medium mb-2 block">포트폴리오</label>
          {portfolios.length === 0 ? (
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-2">
                포트폴리오가 없습니다.
              </p>
              <Button size="sm" asChild>
                <Link href="/portfolio/new">포트폴리오 만들기</Link>
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
                  {p.name} ({p.currency})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* 금액 입력 */}
        <div>
          <label className="text-sm font-medium mb-2 block">매수 금액</label>
          <div className="relative">
            <Input
              type="number"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-2xl h-14 pr-16"
              step="0.01"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              {currency}
            </span>
          </div>
        </div>

        {/* 환율 */}
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
                원/{currency}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
              <Info className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                현재 환율:{" "}
                <strong className="tabular-nums">{formatRate(currentRate)}</strong>{" "}
                원/{currency}
              </span>
            </div>
          )}
        </div>

        {/* 수수료 */}
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

        {/* 거래일 */}
        <div>
          <label className="text-sm font-medium mb-2 block">거래일</label>
          <Input
            type="date"
            value={tradedAt}
            onChange={(e) => setTradedAt(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
          />
        </div>

        {/* 계산 결과 */}
        {amountNum > 0 && effectiveRate > 0 && (
          <div className="space-y-3 p-4 border rounded-lg">
            <div className="flex justify-between">
              <span className="text-muted-foreground">매수 금액</span>
              <span className="tabular-nums">{formatKRW(krwAmount)}</span>
            </div>
            {feeNum > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">수수료</span>
                <span className="tabular-nums">{formatKRW(feeNum)}</span>
              </div>
            )}
            <hr />
            <div className="flex justify-between font-semibold">
              <span>총 필요 금액</span>
              <span className="tabular-nums text-red-600">{formatKRW(totalKrw)}</span>
            </div>
          </div>
        )}

        {/* 메모 */}
        <div>
          <label className="text-sm font-medium mb-2 block">메모 (선택)</label>
          <Input
            placeholder="거래 메모를 입력하세요"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            maxLength={200}
          />
        </div>

        {/* 제출 버튼 */}
        <Button
          variant="buy"
          size="lg"
          className="w-full"
          disabled={
            !portfolioId ||
            amountNum <= 0 ||
            effectiveRate <= 0 ||
            isSubmitting
          }
          onClick={handleSubmit}
        >
          {isSubmitting
            ? "처리 중..."
            : `${amountNum.toLocaleString()} ${currency} 매수 기록`}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function BuyPage() {
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
          <BuyForm />
        </Suspense>
      </main>
    </div>
  );
}
