import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 숫자 포맷팅 (원화)
export function formatKRW(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(num);
}

// 숫자 포맷팅 (외화)
export function formatCurrency(
  amount: number | string,
  currency: string = "USD"
): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(num);
}

// 환율 포맷팅
export function formatRate(rate: number | string): string {
  const num = typeof rate === "string" ? parseFloat(rate) : rate;
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

// 퍼센트 포맷팅
export function formatPercent(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  const sign = num >= 0 ? "+" : "";
  return `${sign}${num.toFixed(2)}%`;
}

// 날짜 포맷팅
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// 날짜시간 포맷팅
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

// 수익률 계산
export function calculateProfitRate(
  currentRate: number,
  avgBuyRate: number
): number {
  if (avgBuyRate === 0) return 0;
  return ((currentRate - avgBuyRate) / avgBuyRate) * 100;
}

// 평균 단가 계산
export function calculateAvgRate(
  currentBalance: number,
  currentAvgRate: number,
  newAmount: number,
  newRate: number,
  type: "BUY" | "SELL"
): number {
  if (type === "SELL") {
    return currentAvgRate; // 매도 시 평균 단가 유지
  }

  const totalBalance = currentBalance + newAmount;
  if (totalBalance === 0) return 0;

  return (
    (currentBalance * currentAvgRate + newAmount * newRate) / totalBalance
  );
}
