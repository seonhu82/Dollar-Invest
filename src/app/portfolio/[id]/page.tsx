"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Wallet,
  TrendingUp,
  TrendingDown,
  Edit2,
  Trash2,
  Star,
  History,
} from "lucide-react";
import Link from "next/link";
import { formatKRW, formatCurrency, formatRate, formatPercent } from "@/lib/utils";

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
  createdAt: string;
  recentTransactions: {
    id: string;
    type: string;
    amount: number;
    rate: number;
    krwAmount: number;
    tradedAt: string;
    memo: string | null;
  }[];
}

export default function PortfolioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentRate, setCurrentRate] = useState(0);

  // 편집 모드
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // 삭제 확인
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchPortfolio();
    fetchCurrentRate();
  }, [id]);

  const fetchPortfolio = async () => {
    try {
      const res = await fetch(`/api/portfolios/${id}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      setPortfolio(data.portfolio);
      setEditName(data.portfolio.name);
      setEditDescription(data.portfolio.description || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentRate = async () => {
    try {
      const res = await fetch("/api/exchange/rates");
      const data = await res.json();
      if (data.rates) {
        const rate = data.rates.find(
          (r: { currency: string }) => r.currency === portfolio?.currency
        );
        if (rate) setCurrentRate(rate.rate);
      }
    } catch {
      // 환율 조회 실패 시 무시
    }
  };

  useEffect(() => {
    if (portfolio) {
      fetchCurrentRate();
    }
  }, [portfolio?.currency]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/portfolios/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, description: editDescription }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      await fetchPortfolio();
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/portfolios/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      router.push("/portfolio");
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제에 실패했습니다.");
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleSetDefault = async () => {
    try {
      const res = await fetch(`/api/portfolios/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      await fetchPortfolio();
    } catch (err) {
      setError(err instanceof Error ? err.message : "설정에 실패했습니다.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-48" />
            <div className="h-64 bg-gray-200 rounded" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !portfolio) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-4xl mx-auto px-4 py-8 text-center">
          <p className="text-red-600 mb-4">{error || "포트폴리오를 찾을 수 없습니다."}</p>
          <Button asChild>
            <Link href="/portfolio">포트폴리오 목록으로</Link>
          </Button>
        </main>
      </div>
    );
  }

  const rateToUse = currentRate || portfolio.avgBuyRate;
  const currentValue = portfolio.currentBalance * rateToUse;
  const profitLoss = currentValue - portfolio.totalInvested;
  const profitPercent =
    portfolio.totalInvested > 0
      ? (profitLoss / portfolio.totalInvested) * 100
      : 0;
  const isProfit = profitLoss >= 0;

  const brokerLabel: Record<string, string> = {
    HANA: "하나증권",
    KIS: "한국투자증권",
    MANUAL: "수동 입력",
  };

  const currencyFlags: Record<string, string> = {
    USD: "🇺🇸",
    EUR: "🇪🇺",
    JPY: "🇯🇵",
    CNY: "🇨🇳",
    GBP: "🇬🇧",
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* 뒤로가기 & 액션 */}
        <div className="flex items-center justify-between">
          <Link
            href="/portfolio"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            포트폴리오 목록
          </Link>

          <div className="flex items-center gap-2">
            {!portfolio.isDefault && (
              <Button variant="outline" size="sm" onClick={handleSetDefault}>
                <Star className="h-4 w-4 mr-1" />
                기본으로 설정
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(!editing)}
            >
              <Edit2 className="h-4 w-4 mr-1" />
              편집
            </Button>
            {!portfolio.isDefault && (
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* 삭제 확인 */}
        {showDeleteConfirm && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-4">
              <p className="text-red-800 mb-3">
                정말로 이 포트폴리오를 삭제하시겠습니까? 모든 거래 내역도 함께 삭제됩니다.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  취소
                </Button>
                <Button
                  size="sm"
                  className="bg-red-600 hover:bg-red-700"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "삭제 중..." : "삭제"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 메인 정보 */}
        <Card>
          <CardHeader>
            {editing ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>이름</Label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={50}
                  />
                </div>
                <div className="space-y-2">
                  <Label>설명</Label>
                  <Input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="포트폴리오 설명"
                    maxLength={200}
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? "저장 중..." : "저장"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(false);
                      setEditName(portfolio.name);
                      setEditDescription(portfolio.description || "");
                    }}
                  >
                    취소
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">
                    {currencyFlags[portfolio.currency] || "💱"}
                  </span>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {portfolio.name}
                      {portfolio.isDefault && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          기본
                        </span>
                      )}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {portfolio.currency} •{" "}
                      {brokerLabel[portfolio.broker] || portfolio.broker}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {portfolio.description && !editing && (
              <p className="text-sm text-muted-foreground mb-6">
                {portfolio.description}
              </p>
            )}

            {/* 요약 통계 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-muted-foreground mb-1">보유량</p>
                <p className="text-xl font-bold tabular-nums">
                  {formatCurrency(portfolio.currentBalance, portfolio.currency)}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-muted-foreground mb-1">평가 금액</p>
                <p className="text-xl font-bold tabular-nums">
                  {formatKRW(currentValue)}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-muted-foreground mb-1">평가 손익</p>
                <p
                  className={`text-xl font-bold tabular-nums ${
                    isProfit ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {isProfit ? "+" : ""}
                  {formatKRW(profitLoss)}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-muted-foreground mb-1">수익률</p>
                <p
                  className={`text-xl font-bold tabular-nums flex items-center gap-1 ${
                    isProfit ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {isProfit ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  {formatPercent(profitPercent)}
                </p>
              </div>
            </div>

            {/* 상세 정보 */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6 pt-6 border-t">
              <div>
                <p className="text-xs text-muted-foreground">투자 원금</p>
                <p className="font-medium tabular-nums">
                  {formatKRW(portfolio.totalInvested)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">평균 매수가</p>
                <p className="font-medium tabular-nums">
                  {formatRate(portfolio.avgBuyRate)}원
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">현재 환율</p>
                <p className="font-medium tabular-nums">
                  {formatRate(rateToUse)}원
                </p>
              </div>
            </div>

            {/* 거래 버튼 */}
            <div className="flex gap-3 mt-6">
              <Button variant="buy" className="flex-1" asChild>
                <Link href={`/trade/buy?portfolio=${portfolio.id}`}>매수</Link>
              </Button>
              <Button variant="sell" className="flex-1" asChild>
                <Link href={`/trade/sell?portfolio=${portfolio.id}`}>매도</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 최근 거래 내역 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              최근 거래 내역
            </CardTitle>
          </CardHeader>
          <CardContent>
            {portfolio.recentTransactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                아직 거래 내역이 없습니다.
              </p>
            ) : (
              <div className="space-y-3">
                {portfolio.recentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          tx.type === "BUY"
                            ? "bg-red-100 text-red-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {tx.type === "BUY" ? "매수" : "매도"}
                      </span>
                      <div>
                        <p className="font-medium tabular-nums">
                          {formatCurrency(tx.amount, portfolio.currency)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatRate(tx.rate)}원 •{" "}
                          {new Date(tx.tradedAt).toLocaleDateString("ko-KR")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium tabular-nums">
                        {formatKRW(tx.krwAmount)}
                      </p>
                      {tx.memo && (
                        <p className="text-xs text-muted-foreground">
                          {tx.memo}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button variant="outline" className="w-full mt-4" asChild>
              <Link href={`/trade?portfolio=${portfolio.id}`}>
                전체 거래 내역 보기
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
