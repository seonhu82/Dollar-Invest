"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRate, formatPercent, getDisplayRate } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type SignalTier = "STRONG_SELL" | "SELL" | "NEUTRAL" | "WATCH" | "BUY" | "STRONG_BUY";

const TIER_BADGE_STYLES: Record<SignalTier, string> = {
  STRONG_BUY: "bg-green-600 text-white",
  BUY: "bg-lime-500 text-white",
  WATCH: "bg-blue-500 text-white",
  NEUTRAL: "bg-gray-400 text-white",
  SELL: "bg-orange-500 text-white",
  STRONG_SELL: "bg-red-600 text-white",
};

interface AlertInfo {
  tier: string;
  tierLabel: string;
  score: number;
}

interface RateCardProps {
  currency: string;
  currencyName: string;
  koreanName?: string;
  rate: number;
  change: number;
  changePercent: number;
  high?: number;
  low?: number;
  alert?: AlertInfo;
  selected?: boolean;
  onClick?: () => void;
}

export function RateCard({
  currency,
  currencyName,
  koreanName,
  rate,
  change,
  changePercent,
  high,
  low,
  alert,
  selected,
  onClick,
}: RateCardProps) {
  const isPositive = change > 0;
  const isNegative = change < 0;

  const currencyFlags: Record<string, string> = {
    USD: "\u{1F1FA}\u{1F1F8}",
    EUR: "\u{1F1EA}\u{1F1FA}",
    JPY: "\u{1F1EF}\u{1F1F5}",
    CNY: "\u{1F1E8}\u{1F1F3}",
    GBP: "\u{1F1EC}\u{1F1E7}",
  };

  const isJPY = currency === "JPY";
  const displayRate = getDisplayRate(currency, rate);
  const displayChange = isJPY ? change * 100 : change;
  const displayHigh = high ? getDisplayRate(currency, high) : undefined;
  const displayLow = low ? getDisplayRate(currency, low) : undefined;

  return (
    <Card
      className={cn(
        onClick && "cursor-pointer hover:shadow-md transition-shadow",
        selected && "ring-2 ring-gray-900 shadow-md"
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{currencyFlags[currency] || "\u{1F4B1}"}</span>
          <div>
            <CardTitle className="text-sm font-semibold text-gray-900">
              {isJPY ? "JPY(100)" : currency}
            </CardTitle>
            <p className="text-[10px] text-muted-foreground leading-tight">
              {koreanName && <span className="block">{koreanName}</span>}
              {isJPY ? "100JPY" : currency}/{currencyName}
            </p>
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
              {isPositive ? "\u25B2" : isNegative ? "\u25BC" : ""} {formatRate(Math.abs(displayChange))} ({formatPercent(changePercent)})
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
        {alert && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className={cn(
              "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold",
              TIER_BADGE_STYLES[alert.tier as SignalTier] || "bg-gray-400 text-white"
            )}>
              {alert.tierLabel}
            </span>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {alert.score > 0 ? "+" : ""}{alert.score}점
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
