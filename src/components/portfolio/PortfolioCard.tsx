"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatKRW, formatPercent, formatRate, getDisplayRate, getRateUnit } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Wallet, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";

interface PortfolioCardProps {
  id: string;
  name: string;
  currency: string;
  currentBalance: number;
  avgBuyRate: number;
  totalInvested: number;
  totalRealizedPnl?: number;
  currentRate: number;
  broker: string;
}

export function PortfolioCard({
  id,
  name,
  currency,
  currentBalance,
  avgBuyRate,
  totalInvested,
  totalRealizedPnl = 0,
  currentRate,
  broker,
}: PortfolioCardProps) {
  // 현재 평가액
  const currentValue = currentBalance * currentRate;

  // 수익/손실
  const profitLoss = currentValue - totalInvested;
  const profitLossPercent =
    totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;

  const isProfit = profitLoss >= 0;

  // 브로커 라벨
  const brokerLabel = {
    HANA: "하나증권",
    KIS: "한국투자증권",
    MANUAL: "수동 입력",
  }[broker] || broker;

  const currencyFlags: Record<string, string> = {
    USD: "🇺🇸",
    EUR: "🇪🇺",
    JPY: "🇯🇵",
    CNY: "🇨🇳",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{currencyFlags[currency] || "💱"}</span>
            <div>
              <CardTitle className="text-base font-semibold text-gray-900">{name}</CardTitle>
              <p className="text-xs text-muted-foreground">{currency}</p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground px-2 py-1 bg-gray-100 rounded-lg">
            {brokerLabel}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 보유량 & 수익 */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">보유량</p>
            <p className="text-xl font-bold tabular-nums text-gray-900">
              {formatCurrency(currentBalance, currency)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground mb-0.5">평가손익</p>
            <p className={cn(
              "text-lg font-bold tabular-nums",
              isProfit ? "text-emerald-600" : "text-red-600"
            )}>
              {formatPercent(profitLossPercent)}
            </p>
            <p className={cn(
              "text-xs tabular-nums",
              isProfit ? "text-emerald-600" : "text-red-600"
            )}>
              {isProfit ? "+" : ""}{formatKRW(profitLoss)}
            </p>
          </div>
        </div>

        {/* 상세 정보 */}
        <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-xl text-xs">
          <div>
            <p className="text-muted-foreground">평균 매수가</p>
            <p className="font-medium tabular-nums text-gray-900">{formatRate(getDisplayRate(currency, avgBuyRate))}원/{getRateUnit(currency)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">현재 환율</p>
            <p className="font-medium tabular-nums text-gray-900">{formatRate(getDisplayRate(currency, currentRate))}원/{getRateUnit(currency)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">투자 원금</p>
            <p className="font-medium tabular-nums text-gray-900">{formatKRW(totalInvested)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">평가 금액</p>
            <p className="font-medium tabular-nums text-gray-900">{formatKRW(currentValue)}</p>
          </div>
          {totalRealizedPnl !== 0 && (
            <div className="col-span-2">
              <p className="text-muted-foreground">실현 손익</p>
              <p className={cn(
                "font-medium tabular-nums",
                totalRealizedPnl >= 0 ? "text-emerald-600" : "text-red-600"
              )}>
                {totalRealizedPnl >= 0 ? "+" : ""}{formatKRW(totalRealizedPnl)}
              </p>
            </div>
          )}
        </div>

        {/* 액션 버튼 - 이것만 강조 */}
        <div className="flex gap-2">
          <Button variant="buy" size="sm" className="flex-1" asChild>
            <Link href={`/trade/buy?portfolio=${id}`}>매수</Link>
          </Button>
          <Button variant="sell" size="sm" className="flex-1" asChild>
            <Link href={`/trade/sell?portfolio=${id}`}>매도</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/portfolio/${id}`}>상세</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
