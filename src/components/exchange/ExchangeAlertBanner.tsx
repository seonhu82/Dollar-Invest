"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getDisplayRate, getRateUnit } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Activity,
  BarChart3,
  Zap,
  Eye,
  ShieldAlert,
  Info,
  Check,
  X as XIcon,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

// ========== Types (서버 API 응답 매칭) ==========

type SignalTier =
  | "STRONG_SELL"
  | "SELL"
  | "NEUTRAL"
  | "WATCH"
  | "BUY"
  | "STRONG_BUY";

interface IndicatorSignal {
  signal: string;
  passed: boolean;
  detail: string;
}

interface AlertStatus {
  currency: string;
  currencyLabel: string;
  tier: SignalTier;
  tierLabel: string;
  score: number;
  isActive: boolean;
  indicators: {
    cci: number;
    rsi: number;
    bbUpper: number;
    bbMiddle: number;
    bbLower: number;
    bbPercB: number;
    ma50: number;
    ma20: number;
    currentRate: number;
    previousClose: number;
  };
  changePercent: number;
  signals: {
    trendFilter: IndicatorSignal;
    cci: IndicatorSignal;
    rsi: IndicatorSignal;
    bb: IndicatorSignal;
    maCross: IndicatorSignal;
  };
  characteristics: string;
  lastCheckedAt: string;
}

interface RecentCandle {
  date: string;
  close: number;
  cci: number;
  rsi: number;
  bbPercB: number;
  bbPos: string;
}

interface AlertReport extends AlertStatus {
  recentCandles: RecentCandle[];
  summary: {
    daysAboveMA50: number;
    daysBelowMA50: number;
    low20D: number;
    high20D: number;
    bbWidthPct: number;
    trendDir: string;
    analysis: string;
  };
}

// ========== 신호별 스타일 ==========

const TIER_STYLES: Record<
  SignalTier,
  {
    bg: string;
    border: string;
    badge: string;
    text: string;
    accent: string;
    icon: typeof TrendingUp;
    pulse?: boolean;
  }
> = {
  STRONG_SELL: {
    bg: "bg-gradient-to-r from-red-50/90 to-rose-50/70",
    border: "border-red-200/60",
    badge: "bg-red-600 text-white shadow-red-500/20 shadow-md",
    text: "text-red-800",
    accent: "text-red-600",
    icon: ShieldAlert,
  },
  SELL: {
    bg: "bg-gradient-to-r from-orange-50/90 to-amber-50/70",
    border: "border-orange-200/60",
    badge: "bg-orange-500 text-white shadow-orange-500/20 shadow-md",
    text: "text-orange-800",
    accent: "text-orange-600",
    icon: TrendingUp,
  },
  NEUTRAL: {
    bg: "bg-gradient-to-r from-gray-50/90 to-slate-50/70",
    border: "border-gray-200/60",
    badge: "bg-gray-500 text-white shadow-gray-500/15 shadow-sm",
    text: "text-gray-700",
    accent: "text-gray-500",
    icon: Minus,
  },
  WATCH: {
    bg: "bg-gradient-to-r from-blue-50/90 to-indigo-50/70",
    border: "border-blue-200/60",
    badge: "bg-blue-500 text-white shadow-blue-500/20 shadow-md",
    text: "text-blue-800",
    accent: "text-blue-600",
    icon: Eye,
  },
  BUY: {
    bg: "bg-gradient-to-r from-emerald-50/90 to-teal-50/70",
    border: "border-emerald-200/60",
    badge: "bg-amber-500 text-white shadow-amber-500/20 shadow-md",
    text: "text-emerald-800",
    accent: "text-emerald-600",
    icon: TrendingDown,
  },
  STRONG_BUY: {
    bg: "bg-gradient-to-r from-green-50/90 to-emerald-50/70",
    border: "border-green-300/60",
    badge: "bg-emerald-600 text-white shadow-emerald-500/30 shadow-lg",
    text: "text-green-800",
    accent: "text-green-600",
    icon: Zap,
    pulse: true,
  },
};

const CURRENCY_ICONS: Record<string, string> = {
  USD: "$",
  EUR: "\u20ac",
  JPY: "\u00a5",
  GBP: "\u00a3",
  CNY: "\u00a5",
};

// ========== 포맷팅 ==========

function formatRateDisplay(currency: string, rate: number): string {
  const displayRate = getDisplayRate(currency, rate);
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(displayRate);
}

// ========== 메인 배너 컴포넌트 ==========

export function ExchangeAlertBanner() {
  const [alerts, setAlerts] = useState<AlertStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [report, setReport] = useState<AlertReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rotateRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 배너 데이터 fetch
  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/exchange-alert/status");
      if (!res.ok) return;
      const data = await res.json();
      if (data.alerts && data.alerts.length > 0) {
        setAlerts(data.alerts);
      }
    } catch {
      // 실패 시 기존 데이터 유지
    } finally {
      setLoading(false);
    }
  }, []);

  // 상세 리포트 fetch
  const fetchReport = useCallback(async (currency: string) => {
    setReportLoading(true);
    try {
      const res = await fetch(`/api/exchange-alert/report?currency=${currency}`);
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch {
      // 실패 시 무시
    } finally {
      setReportLoading(false);
    }
  }, []);

  // 활동 기반 폴링 (탭 활성 시에만)
  useEffect(() => {
    fetchAlerts();

    const startPolling = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(fetchAlerts, 5 * 60 * 1000);
    };

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchAlerts();
        startPolling();
      } else {
        stopPolling();
      }
    };

    startPolling();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchAlerts]);

  // 통화 로테이션 (8초 간격)
  useEffect(() => {
    if (alerts.length <= 1) return;

    rotateRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % alerts.length);
    }, 8000);

    return () => {
      if (rotateRef.current) clearInterval(rotateRef.current);
    };
  }, [alerts.length]);

  // 리포트 다이얼로그 열기
  const openReport = (currency: string) => {
    setReportOpen(true);
    setReport(null);
    fetchReport(currency);
  };

  // 로딩 스켈레톤
  if (loading) {
    return (
      <div className="w-full border-b border-gray-100 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-10 flex items-center">
            <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (alerts.length === 0) return null;

  const current = alerts[currentIndex % alerts.length];
  if (!current) return null;

  const style = TIER_STYLES[current.tier];
  const Icon = style.icon;
  const icon = CURRENCY_ICONS[current.currency] || current.currency;
  const rateUnit = getRateUnit(current.currency);
  const isUp = current.changePercent > 0;
  const isDown = current.changePercent < 0;

  return (
    <>
      <div
        className={cn(
          "w-full border-b transition-all duration-500",
          style.bg,
          style.border,
          style.pulse && "animate-[pulse_3s_ease-in-out_infinite]"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => openReport(current.currency)}
            className="w-full h-10 flex items-center justify-between gap-3 text-sm group cursor-pointer"
          >
            {/* 좌: 통화 + 신호 배지 */}
            <div className="flex items-center gap-2.5 min-w-0">
              {/* 통화 아이콘 */}
              <span className="flex items-center justify-center w-6 h-6 rounded-md bg-white/80 border border-gray-200/50 text-xs font-bold text-gray-700 shrink-0">
                {icon}
              </span>

              {/* 통화명 */}
              <span className={cn("font-semibold whitespace-nowrap text-xs sm:text-sm", style.text)}>
                {current.currencyLabel}
              </span>

              {/* 신호 배지 */}
              <span className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold tracking-tight shrink-0",
                style.badge
              )}>
                <Icon className="h-3 w-3" />
                {current.tierLabel}
              </span>

              {/* 환율 */}
              <span className="font-mono font-semibold text-gray-900 tabular-nums text-sm">
                {formatRateDisplay(current.currency, current.indicators.currentRate)}
              </span>
              <span className="text-[10px] text-gray-400 hidden sm:inline">{rateUnit}</span>

              {/* 등락 */}
              <span className={cn(
                "flex items-center gap-0.5 text-xs font-medium tabular-nums",
                isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-gray-400"
              )}>
                {isUp ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : isDown ? (
                  <ArrowDownRight className="h-3 w-3" />
                ) : null}
                {isUp ? "+" : ""}{current.changePercent.toFixed(2)}%
              </span>
            </div>

            {/* 중: 지표 요약 (md 이상) */}
            <div className="hidden md:flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="text-gray-400">CCI</span>
                <span className={cn(
                  "font-mono font-medium tabular-nums",
                  current.indicators.cci < -100 ? "text-emerald-600" :
                  current.indicators.cci > 100 ? "text-red-500" : "text-gray-600"
                )}>
                  {current.indicators.cci.toFixed(0)}
                </span>
              </span>
              <span className="text-gray-300">|</span>
              <span className="flex items-center gap-1">
                <span className="text-gray-400">RSI</span>
                <span className={cn(
                  "font-mono font-medium tabular-nums",
                  current.indicators.rsi < 35 ? "text-emerald-600" :
                  current.indicators.rsi > 65 ? "text-red-500" : "text-gray-600"
                )}>
                  {current.indicators.rsi.toFixed(0)}
                </span>
              </span>
              <span className="text-gray-300">|</span>
              <span className="flex items-center gap-1">
                <span className="text-gray-400">BB</span>
                <span className="font-medium text-gray-600">
                  {current.indicators.bbPercB < 0.2 ? "하단↓" :
                   current.indicators.bbPercB > 0.8 ? "상단↑" :
                   current.indicators.bbPercB < 0.5 ? "중간↓" : "중간↑"}
                </span>
              </span>
            </div>

            {/* 우: 상세보기 + 로테이션 도트 */}
            <div className="flex items-center gap-2.5 shrink-0">
              {/* 로테이션 인디케이터 */}
              {alerts.length > 1 && (
                <div className="hidden sm:flex items-center gap-1">
                  {alerts.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentIndex(i);
                      }}
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-300",
                        i === currentIndex % alerts.length
                          ? "bg-gray-600 w-3"
                          : "bg-gray-300 hover:bg-gray-400 w-1.5"
                      )}
                    />
                  ))}
                </div>
              )}

              <span className="text-xs text-gray-400 group-hover:text-gray-600 transition-colors flex items-center gap-0.5">
                <BarChart3 className="h-3.5 w-3.5" />
                <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* 상세 리포트 다이얼로그 */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-gray-600" />
              {report?.currencyLabel || current.currencyLabel} 환율 분석 리포트
            </DialogTitle>
            <DialogDescription>
              기술적 지표 기반 6단계 종합 분석 ({rateUnit}/KRW)
            </DialogDescription>
          </DialogHeader>

          {reportLoading || !report ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-28 bg-gray-100 rounded-xl" />
              <div className="h-32 bg-gray-100 rounded-xl" />
              <div className="h-48 bg-gray-100 rounded-xl" />
            </div>
          ) : (
            <ReportContent report={report} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ========== 리포트 내용 ==========

function ReportContent({ report }: { report: AlertReport }) {
  const style = TIER_STYLES[report.tier];
  const Icon = style.icon;
  const rateUnit = getRateUnit(report.currency);
  const isUp = report.changePercent > 0;
  const isDown = report.changePercent < 0;

  return (
    <div className="space-y-5">
      {/* 섹션 1: 헤더 - 현재 환율 + 신호 + 게이지 */}
      <div className={cn("rounded-xl border p-4", style.bg, style.border)}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold",
                style.badge
              )}>
                <Icon className="h-3.5 w-3.5" />
                {report.tierLabel}
              </span>
              <span className="text-xs text-gray-500">
                스코어 {report.score}점
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900 tabular-nums">
                {formatRateDisplay(report.currency, report.indicators.currentRate)}
              </span>
              <span className="text-sm text-gray-500">{rateUnit}/KRW</span>
            </div>
            <span className={cn(
              "inline-flex items-center text-sm font-medium tabular-nums mt-1",
              isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-gray-400"
            )}>
              {isUp ? <ArrowUpRight className="h-4 w-4" /> :
               isDown ? <ArrowDownRight className="h-4 w-4" /> : null}
              {isUp ? "+" : ""}{report.changePercent.toFixed(2)}%
              <span className="text-xs text-gray-400 ml-1.5">전일 대비</span>
            </span>
          </div>

          {/* 6단계 게이지 */}
          <div className="w-28">
            <div className="flex justify-between text-[9px] text-gray-400 mb-1">
              <span>매수</span>
              <span>매도</span>
            </div>
            <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-gray-300 to-red-400 opacity-40 rounded-full" />
              <div
                className="absolute top-[-2px] w-3 h-3 rounded-full bg-white border-2 border-gray-800 shadow-md transition-all duration-500"
                style={{
                  left: `${Math.max(2, Math.min(97, ((report.score + 100) / 200) * 100))}%`,
                  transform: "translateX(-50%)",
                }}
              />
            </div>
            <div className="flex justify-between text-[9px] tabular-nums text-gray-400 mt-0.5">
              <span>-100</span>
              <span>0</span>
              <span>+100</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-500">
          {report.characteristics}
        </p>
      </div>

      {/* 섹션 2: 기술적 지표 판정 */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <BarChart3 className="h-4 w-4 text-gray-500" />
          기술적 지표 분석
        </h3>
        <div className="rounded-xl border border-gray-200 overflow-hidden">
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
              {Object.entries(report.signals).map(([key, sig]) => {
                const labels: Record<string, string> = {
                  trendFilter: "추세 (MA50)",
                  cci: "CCI(20)",
                  rsi: "RSI(14)",
                  bb: "BB %B(20,2)",
                  maCross: "MA 크로스",
                };
                return (
                  <tr key={key} className="hover:bg-gray-50/50">
                    <td className="px-3 py-2.5 font-medium text-gray-700 text-xs">
                      {labels[key]}
                    </td>
                    <td className="px-3 py-2.5 text-xs tabular-nums text-gray-600">
                      {sig.detail}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-600 max-w-[180px] truncate">
                      {sig.signal}
                    </td>
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
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 섹션 3: 최근 20일 캔들 추이 */}
      {report.recentCandles && report.recentCandles.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-gray-500" />
            최근 20일 추이
          </h3>
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="max-h-[280px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50/95 backdrop-blur-sm">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">날짜</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-500">환율</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-500">CCI</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-500">RSI</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-500">BB위치</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...report.recentCandles].reverse().map((c, i) => (
                    <tr
                      key={c.date}
                      className={cn(
                        "hover:bg-gray-50/50 transition-colors",
                        i === 0 && "bg-gray-50 font-medium",
                        c.cci < -100 && "bg-emerald-50/30",
                        c.cci > 100 && "bg-red-50/30",
                      )}
                    >
                      <td className="px-3 py-2 tabular-nums text-gray-600">
                        {c.date.slice(5)}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-right font-medium text-gray-800">
                        {formatRateDisplay(report.currency, c.close)}
                      </td>
                      <td className={cn(
                        "px-3 py-2 tabular-nums text-right font-medium",
                        c.cci < -100 ? "text-emerald-600" :
                        c.cci > 100 ? "text-red-500" : "text-gray-500"
                      )}>
                        {c.cci.toFixed(0)}
                      </td>
                      <td className={cn(
                        "px-3 py-2 tabular-nums text-right font-medium",
                        c.rsi < 35 ? "text-emerald-600" :
                        c.rsi > 65 ? "text-red-500" : "text-gray-500"
                      )}>
                        {c.rsi.toFixed(0)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={cn(
                          "inline-block px-1.5 py-0.5 rounded text-[10px] font-medium",
                          c.bbPos.includes("하단") ? "bg-emerald-100 text-emerald-700" :
                          c.bbPos.includes("상단") ? "bg-red-100 text-red-700" :
                          "bg-gray-100 text-gray-600"
                        )}>
                          {c.bbPos}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 섹션 4: 종합 판단 */}
      {report.summary && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <Info className="h-4 w-4 text-gray-500" />
            종합 판단
          </h3>
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="text-center">
                <p className="text-[11px] text-gray-500">MA50 상회</p>
                <p className="text-lg font-bold tabular-nums text-gray-800">{report.summary.daysAboveMA50}일</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] text-gray-500">MA50 하회</p>
                <p className="text-lg font-bold tabular-nums text-gray-800">{report.summary.daysBelowMA50}일</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] text-gray-500">20일 저점</p>
                <p className="text-lg font-bold tabular-nums text-blue-600">
                  {formatRateDisplay(report.currency, report.summary.low20D)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[11px] text-gray-500">20일 고점</p>
                <p className="text-lg font-bold tabular-nums text-red-500">
                  {formatRateDisplay(report.currency, report.summary.high20D)}
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
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">
                {report.summary.analysis}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 마지막 확인 시간 */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <p className="text-[11px] text-gray-400">
          {report.isActive ? "시장 개장 중" : "시장 마감"} · 30분 캐시
        </p>
        <p className="text-[11px] text-gray-400 tabular-nums">
          {new Date(report.lastCheckedAt).toLocaleString("ko-KR", {
            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
          })} 기준
        </p>
      </div>
    </div>
  );
}
