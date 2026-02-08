"use client";

import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { formatKRW, formatRate, formatDateTime, formatCurrency } from "@/lib/utils";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Search,
  RefreshCw,
  Trash2,
} from "lucide-react";
import Link from "next/link";

interface Transaction {
  id: string;
  type: string;
  currency: string;
  amount: number;
  rate: number;
  krwAmount: number;
  fee: number;
  memo: string | null;
  tradedAt: string;
  portfolioId: string;
  portfolioName: string;
  isManual: boolean;
}

export default function TradePage() {
  const searchParams = useSearchParams();
  const portfolioIdFilter = searchParams.get("portfolio");

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "BUY" | "SELL">("ALL");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchTransactions = async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (portfolioIdFilter) params.set("portfolioId", portfolioIdFilter);
      if (filterType !== "ALL") params.set("type", filterType);

      const res = await fetch(`/api/transactions?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      setTransactions(data.transactions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [filterType, portfolioIdFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm("이 거래를 삭제하시겠습니까?")) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      await fetchTransactions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch =
      !searchTerm ||
      tx.memo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.portfolioName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">거래</h1>
            <p className="text-muted-foreground">외화 매수/매도 및 거래 내역</p>
          </div>
          <div className="flex gap-2">
            <Button variant="buy" asChild>
              <Link href="/trade/buy">
                <ArrowDownCircle className="h-4 w-4 mr-2" />
                매수
              </Link>
            </Button>
            <Button variant="sell" asChild>
              <Link href="/trade/sell">
                <ArrowUpCircle className="h-4 w-4 mr-2" />
                매도
              </Link>
            </Button>
          </div>
        </div>

        {/* 에러 */}
        {error && (
          <div className="p-4 text-sm text-red-600 bg-red-50 rounded-lg">
            {error}
          </div>
        )}

        {/* 필터 */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="메모, 포트폴리오 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={filterType === "ALL" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType("ALL")}
                >
                  전체
                </Button>
                <Button
                  variant={filterType === "BUY" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType("BUY")}
                  className={
                    filterType === "BUY" ? "bg-red-500 hover:bg-red-600" : ""
                  }
                >
                  매수
                </Button>
                <Button
                  variant={filterType === "SELL" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType("SELL")}
                  className={
                    filterType === "SELL" ? "bg-blue-500 hover:bg-blue-600" : ""
                  }
                >
                  매도
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchTransactions}
                  disabled={loading}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 거래 내역 */}
        <Card>
          <CardHeader>
            <CardTitle>거래 내역</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4 border rounded-lg animate-pulse"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-200 rounded-full" />
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-32" />
                        <div className="h-3 bg-gray-200 rounded w-48" />
                      </div>
                    </div>
                    <div className="space-y-2 text-right">
                      <div className="h-4 bg-gray-200 rounded w-24" />
                      <div className="h-3 bg-gray-200 rounded w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="text-center py-12">
                <ArrowDownCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">거래 내역이 없습니다</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  첫 거래를 기록해보세요.
                </p>
                <div className="flex justify-center gap-2">
                  <Button variant="buy" size="sm" asChild>
                    <Link href="/trade/buy">매수하기</Link>
                  </Button>
                  <Button variant="sell" size="sm" asChild>
                    <Link href="/trade/sell">매도하기</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`p-2 rounded-full ${
                          tx.type === "BUY"
                            ? "bg-red-100 text-red-600"
                            : "bg-blue-100 text-blue-600"
                        }`}
                      >
                        {tx.type === "BUY" ? (
                          <ArrowDownCircle className="h-5 w-5" />
                        ) : (
                          <ArrowUpCircle className="h-5 w-5" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-semibold ${
                              tx.type === "BUY" ? "text-red-600" : "text-blue-600"
                            }`}
                          >
                            {tx.type === "BUY" ? "매수" : "매도"}
                          </span>
                          <span className="font-medium tabular-nums">
                            {formatCurrency(tx.amount, tx.currency)}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {tx.portfolioName} ·{" "}
                          {formatDateTime(tx.tradedAt)}
                        </div>
                        {tx.memo && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {tx.memo}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-semibold tabular-nums">
                          {formatKRW(tx.krwAmount)}
                        </div>
                        <div className="text-sm text-muted-foreground tabular-nums">
                          @ {formatRate(tx.rate)}원
                        </div>
                      </div>

                      {tx.isManual && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-red-600"
                          onClick={() => handleDelete(tx.id)}
                          disabled={deletingId === tx.id}
                        >
                          <Trash2
                            className={`h-4 w-4 ${
                              deletingId === tx.id ? "animate-spin" : ""
                            }`}
                          />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
