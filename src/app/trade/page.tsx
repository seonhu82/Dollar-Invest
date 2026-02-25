"use client";

import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { formatKRW, formatRate, formatDateTime, formatCurrency } from "@/lib/utils";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Search,
  RefreshCw,
  Trash2,
  Pencil,
  Check,
  X,
  Loader2,
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

interface EditState {
  rate: string;
  amount: string;
  fee: string;
  memo: string;
}

function TradeContent() {
  const searchParams = useSearchParams();
  const portfolioIdFilter = searchParams.get("portfolio");

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "BUY" | "SELL">("ALL");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ rate: "", amount: "", fee: "", memo: "" });
  const [saving, setSaving] = useState(false);

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

  const handleEditStart = (tx: Transaction) => {
    setEditingId(tx.id);
    setEditState({
      rate: tx.rate.toString(),
      amount: tx.amount.toString(),
      fee: tx.fee.toString(),
      memo: tx.memo || "",
    });
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditState({ rate: "", amount: "", fee: "", memo: "" });
  };

  const handleEditSave = async (tx: Transaction) => {
    const newRate = parseFloat(editState.rate);
    const newAmount = parseFloat(editState.amount);
    const newFee = parseFloat(editState.fee);

    if (!newRate || newRate <= 0) {
      setError("환율은 0보다 커야 합니다.");
      return;
    }
    if (!newAmount || newAmount <= 0) {
      setError("금액은 0보다 커야 합니다.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const body: Record<string, unknown> = {};
      if (newRate !== tx.rate) body.rate = newRate;
      if (newAmount !== tx.amount) body.amount = newAmount;
      if (newFee !== tx.fee) body.fee = newFee;
      if (editState.memo !== (tx.memo || "")) body.memo = editState.memo || null;

      if (Object.keys(body).length === 0) {
        handleEditCancel();
        return;
      }

      const res = await fetch(`/api/transactions/${tx.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      setEditingId(null);
      await fetchTransactions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "수정에 실패했습니다.");
    } finally {
      setSaving(false);
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
                <div key={tx.id}>
                  {/* 수정 모드 */}
                  {editingId === tx.id ? (
                    <div className="p-4 border-2 border-blue-200 rounded-lg bg-blue-50/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-blue-700">
                          거래 수정 - {tx.type === "BUY" ? "매수" : "매도"} {tx.currency}
                        </span>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            onClick={() => handleEditSave(tx)}
                            disabled={saving}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            {saving ? "저장중..." : "저장"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-gray-500 hover:text-gray-700"
                            onClick={handleEditCancel}
                            disabled={saving}
                          >
                            <X className="h-4 w-4 mr-1" />
                            취소
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">적용 환율 (원)</label>
                          <Input
                            type="number"
                            value={editState.rate}
                            onChange={(e) => setEditState({ ...editState, rate: e.target.value })}
                            step="0.01"
                            className="h-9 bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">금액 ({tx.currency})</label>
                          <Input
                            type="number"
                            value={editState.amount}
                            onChange={(e) => setEditState({ ...editState, amount: e.target.value })}
                            step="0.01"
                            className="h-9 bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">수수료 (원)</label>
                          <Input
                            type="number"
                            value={editState.fee}
                            onChange={(e) => setEditState({ ...editState, fee: e.target.value })}
                            step="1"
                            className="h-9 bg-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">메모</label>
                        <Input
                          value={editState.memo}
                          onChange={(e) => setEditState({ ...editState, memo: e.target.value })}
                          placeholder="메모 입력"
                          className="h-9 bg-white"
                          maxLength={200}
                        />
                      </div>

                      {/* 수정 후 예상 금액 미리보기 */}
                      {parseFloat(editState.rate) > 0 && parseFloat(editState.amount) > 0 && (
                        <div className="text-xs text-muted-foreground pt-2 border-t">
                          수정 후 원화 금액: <strong className="text-foreground tabular-nums">
                            {formatKRW(parseFloat(editState.amount) * parseFloat(editState.rate) + (parseFloat(editState.fee) || 0))}
                          </strong>
                          {tx.krwAmount !== parseFloat(editState.amount) * parseFloat(editState.rate) + (parseFloat(editState.fee) || 0) && (
                            <span className="text-orange-600 ml-2">
                              (기존: {formatKRW(tx.krwAmount)})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* 일반 표시 모드 */
                    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-secondary/50 transition-colors">
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

                      <div className="flex items-center gap-2 sm:gap-4">
                        <div className="text-right">
                          <div className="font-semibold tabular-nums">
                            {formatKRW(tx.krwAmount)}
                          </div>
                          <div className="text-sm text-muted-foreground tabular-nums">
                            @ {formatRate(tx.rate)}원
                          </div>
                        </div>

                        {tx.isManual && (
                          <div className="flex gap-0.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-blue-600"
                              onClick={() => handleEditStart(tx)}
                              title="수정"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                              onClick={() => handleDelete(tx.id)}
                              disabled={deletingId === tx.id}
                              title="삭제"
                            >
                              <Trash2
                                className={`h-3.5 w-3.5 ${
                                  deletingId === tx.id ? "animate-spin" : ""
                                }`}
                              />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

export default function TradePage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <TradeContent />
      </Suspense>
    </div>
  );
}
