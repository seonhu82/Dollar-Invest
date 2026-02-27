"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRate, formatPercent, getDisplayRate } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface RateCardProps {
  currency: string;
  currencyName: string;
  rate: number;
  change: number;
  changePercent: number;
  high?: number;
  low?: number;
}

export function RateCard({
  currency,
  currencyName,
  rate,
  change,
  changePercent,
  high,
  low,
}: RateCardProps) {
  const isPositive = change > 0;
  const isNegative = change < 0;

  const currencyFlags: Record<string, string> = {
    USD: "🇺🇸",
    EUR: "🇪🇺",
    JPY: "🇯🇵",
    CNY: "🇨🇳",
    GBP: "🇬🇧",
  };

  const isJPY = currency === "JPY";
  const displayRate = getDisplayRate(currency, rate);
  const displayChange = isJPY ? change * 100 : change;
  const displayHigh = high ? getDisplayRate(currency, high) : undefined;
  const displayLow = low ? getDisplayRate(currency, low) : undefined;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{currencyFlags[currency] || "💱"}</span>
          <div>
            <CardTitle className="text-sm font-semibold text-gray-900">
              {isJPY ? "JPY(100)" : currency}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{isJPY ? "100JPY" : currency}/{currencyName}</p>
          </div>
        </div>
        {isPositive ? (
          <TrendingUp className="h-4 w-4 text-red-500" />
        ) : isNegative ? (
          <TrendingDown className="h-4 w-4 text-blue-500" />
        ) : (
          <Minus className="h-4 w-4 text-gray-400" />
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        <div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums text-gray-900">
            {formatRate(displayRate)}
            <span className="text-xs sm:text-sm font-normal text-muted-foreground ml-1">원</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] sm:text-xs mt-1">
            <span
              className={cn(
                "tabular-nums font-medium",
                isPositive && "text-red-500",
                isNegative && "text-blue-500"
              )}
            >
              {isPositive ? "▲" : isNegative ? "▼" : ""} {formatRate(Math.abs(displayChange))} ({formatPercent(changePercent)})
            </span>
          </div>
        </div>
        {(displayHigh || displayLow) && (
          <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-100">
            {displayHigh && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">고가</span>
                <span className="font-medium text-gray-700">{formatRate(displayHigh)}</span>
              </div>
            )}
            {displayLow && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">저가</span>
                <span className="font-medium text-gray-700">{formatRate(displayLow)}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
