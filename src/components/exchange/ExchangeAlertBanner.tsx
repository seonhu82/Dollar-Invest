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
  ChevronLeft,
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
  ExternalLink,
  Pause,
  RefreshCw,
} from "lucide-react";

// ========== Types (엔진 API 응답 구조에 맞춤) ==========

type SignalTier =
  | "STRONG_SELL"
  | "SELL"
  | "NEUTRAL"
  | "WATCH"
  | "BUY"
  | "STRONG_BUY";

interface AlertStatus {
  currency: string;
  currencyName: string;
  tier: SignalTier;
  tierLabel: string;
  score: number;
  isActive: boolean;
  currentRate: number;
  previousClose: number;
  changePercent: number;
  cci: number;
  rsi: number;
  bbUpper: number;
  bbMiddle: number;
  bbLower: number;
  bbPercent: number;
  ma50: number;
  ma20: number;
  lastCheckedAt: string;
  scoreBreakdown: {
    trend: number;
    momentum: number;
    strength: number;
    volatility: number;
  };
}

interface RecentCandle {
  date: string;
  rate: number;
  cci: number;
  rsi: number;
  bbPercent: number;
  bbPos: string;
  ma50: number;
}

interface AlertReport extends AlertStatus {
  recentCandles: RecentCandle[];
  summary: {
    daysBelow50MA: number;
    low20D: number;
    high20D: number;
    bbWidthPct: number;
    trendDir: string;
    analysis: string;
  };
  config: {
    name: string;
    description: string;
    cciOversold: number;
    cciOverbought: number;
    rsiOversold: number;
    rsiOverbought: number;
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
    bg: "bg-gradient-to-r from-lime-50/90 to-green-50/70",
    border: "border-lime-200/60",
    badge: "bg-lime-500 text-white shadow-lime-500/20 shadow-md",
    text: "text-lime-800",
    accent: "text-lime-600",
    icon: TrendingDown,
  },
  STRONG_BUY: {
    bg: "bg-gradient-to-r from-green-50/90 to-emerald-50/70",
    border: "border-green-300/60",
    badge: "bg-green-600 text-white shadow-green-500/30 shadow-lg",
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

// TradingView 심볼 매핑
const TV_SYMBOLS: Record<string, string> = {
  USD: "FX_IDC:USDKRW",
  EUR: "FX_IDC:EURKRW",
  JPY: "FX_IDC:JPYKRW",
  GBP: "FX_IDC:GBPKRW",
  CNY: "FX_IDC:CNYKRW",
};

// ========== 포맷팅 ==========

function formatRateDisplay(currency: string, rate: number): string {
  const displayRate = getDisplayRate(currency, rate);
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(displayRate);
}

// ========== 지표 신호 도출 ==========

function deriveSignals(report: AlertReport) {
  const { cci, rsi, bbPercent, currentRate, ma50, ma20, scoreBreakdown, config } = report;
  const pctFromMA = ma50 > 0 ? ((currentRate - ma50) / ma50) * 100 : 0;

  return [
    {
      label: "추세 (MA50)",
      value: `${pctFromMA >= 0 ? "+" : ""}${pctFromMA.toFixed(2)}%`,
      signal: currentRate < ma50 ? "MA50 하회 (매수 유리)" : "MA50 상회 (매도 유리)",
      passed: scoreBreakdown.trend > 0,
    },
    {
      label: "CCI(20)",
      value: cci.toFixed(1),
      signal:
        cci <= config.cciOversold ? "과매도 영역" :
        cci >= config.cciOverbought ? "과매수 영역" : "중립 영역",
      passed: scoreBreakdown.momentum > 0,
    },
    {
      label: "RSI(14)",
      value: rsi.toFixed(1),
      signal:
        rsi <= config.rsiOversold ? "과매도 영역" :
        rsi >= config.rsiOverbought ? "과매수 영역" : "중립 영역",
      passed: scoreBreakdown.strength > 0,
    },
    {
      label: "BB %B(20,2)",
      value: `${(bbPercent * 100).toFixed(1)}%`,
      signal:
        bbPercent <= 0.2 ? "하단 근접 (과매도)" :
        bbPercent >= 0.8 ? "상단 근접 (과매수)" : "중간 영역",
      passed: scoreBreakdown.volatility > 0,
    },
    {
      label: "MA 크로스",
      value: `MA20 ${formatRateDisplay(report.currency, ma20)}`,
      signal: ma20 < ma50 ? "데드크로스 (하락추세)" : "골든크로스 (상승추세)",
      passed: ma20 < ma50,
    },
  ];
}

// ========== TradingView 차트 컴포넌트 ==========

function TradingViewChart({ currency }: { currency: string }) {
  const symbol = TV_SYMBOLS[currency] || TV_SYMBOLS.USD;
  const chartUrl = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`;
  const embedUrl = `https://s.tradingview.com/widgetembed/?frameElementId=tv_chart_${currency}&symbol=${encodeURIComponent(symbol)}&interval=D&theme=light&style=1&locale=kr&hide_side_toolbar=1&allow_symbol_change=0&save_image=0&withdateranges=1&hide_volume=1`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <BarChart3 className="h-4 w-4 text-gray-500" />
          TradingView 차트
        </h3>
        <a
          href={chartUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
        >
          TradingView에서 보기
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
        <iframe
          src={embedUrl}
          className="w-full h-[350px] border-0"
          allow="fullscreen"
          loading="lazy"
        />
      </div>
    </div>
  );
}

// ========== 배너 아이템 (각 통화 한 줄) ==========

function BannerItem({
  alert,
  alerts,
  currentIndex,
  onOpenReport,
  onPrev,
  onNext,
  onSetIndex,
}: {
  alert: AlertStatus;
  alerts: AlertStatus[];
  currentIndex: number;
  onOpenReport: (currency: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onSetIndex: (i: number) => void;
}) {
  const style = TIER_STYLES[alert.tier];
  const Icon = style.icon;
  const icon = CURRENCY_ICONS[alert.currency] || alert.currency;
  const rateUnit = getRateUnit(alert.currency);
  const isUp = alert.changePercent > 0;
  const isDown = alert.changePercent < 0;

  return (
    <div className="w-full h-10 flex items-center justify-between gap-2 sm:gap-3 text-sm overflow-hidden">
      {/* 좌: 통화 + 신호 배지 */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 overflow-hidden">
        <span className="flex items-center justify-center w-6 h-6 rounded-md bg-white/80 border border-gray-200/50 text-xs font-bold text-gray-700 shrink-0">
          {icon}
        </span>

        <span className={cn("font-semibold whitespace-nowrap text-xs sm:text-sm", style.text)}>
          {alert.currencyName}
        </span>

        <span className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold tracking-tight shrink-0",
          style.badge
        )}>
          <Icon className="h-3 w-3" />
          {alert.tierLabel}
        </span>

        <span className="font-mono font-semibold text-gray-900 tabular-nums text-sm shrink-0">
          {formatRateDisplay(alert.currency, alert.currentRate)}
        </span>
        <span className="text-[10px] text-gray-400 hidden sm:inline">{rateUnit}</span>

        <span className={cn(
          "hidden sm:flex items-center gap-0.5 text-xs font-medium tabular-nums shrink-0",
          isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-gray-400"
        )}>
          {isUp ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : isDown ? (
            <ArrowDownRight className="h-3 w-3" />
          ) : null}
          {isUp ? "+" : ""}{alert.changePercent.toFixed(2)}%
        </span>
      </div>

      {/* 중: 지표 요약 (md 이상) */}
      <div className="hidden md:flex items-center gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="text-gray-400">CCI</span>
          <span className={cn(
            "font-mono font-medium tabular-nums",
            alert.cci < -100 ? "text-emerald-600" :
            alert.cci > 100 ? "text-red-500" : "text-gray-600"
          )}>
            {alert.cci.toFixed(0)}
          </span>
        </span>
        <span className="text-gray-300">|</span>
        <span className="flex items-center gap-1">
          <span className="text-gray-400">RSI</span>
          <span className={cn(
            "font-mono font-medium tabular-nums",
            alert.rsi < 35 ? "text-emerald-600" :
            alert.rsi > 65 ? "text-red-500" : "text-gray-600"
          )}>
            {alert.rsi.toFixed(0)}
          </span>
        </span>
        <span className="text-gray-300">|</span>
        <span className="flex items-center gap-1">
          <span className="text-gray-400">BB</span>
          <span className="font-medium text-gray-600">
            {alert.bbPercent < 0.2 ? "하단\u2193" :
             alert.bbPercent > 0.8 ? "상단\u2191" :
             alert.bbPercent < 0.5 ? "중간\u2193" : "중간\u2191"}
          </span>
        </span>
      </div>

      {/* 우: 네비게이션 + 상세보기 */}
      <div className="flex items-center gap-1.5 shrink-0">
        {alerts.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPrev();
              }}
              className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors text-gray-400 hover:text-gray-600"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <div className="hidden sm:flex items-center gap-1">
              {alerts.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetIndex(i);
                  }}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    i === currentIndex
                      ? "bg-gray-600 w-3"
                      : "bg-gray-300 hover:bg-gray-400 w-1.5"
                  )}
                />
              ))}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNext();
              }}
              className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors text-gray-400 hover:text-gray-600"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </>
        )}

        <span className="text-xs text-gray-400 group-hover:text-gray-600 transition-colors flex items-center gap-0.5 ml-1">
          <BarChart3 className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
}

// ========== 메인 배너 컴포넌트 ==========

export function ExchangeAlertBanner({ isIdle = false }: { isIdle?: boolean }) {
  const [allAlerts, setAllAlerts] = useState<AlertStatus[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<AlertStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [bannerEnabled, setBannerEnabled] = useState(true);
  const [bannerCurrencies, setBannerCurrencies] = useState<string[]>([]);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<"idle" | "exit" | "enter">("idle");
  const animatingRef = useRef(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [report, setReport] = useState<AlertReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const alertsRef = useRef(filteredAlerts);
  alertsRef.current = filteredAlerts;

  // 배너 설정 로드
  useEffect(() => {
    fetch("/api/settings/banner")
      .then((res) => res.json())
      .then((data) => {
        setBannerEnabled(data.bannerEnabled ?? true);
        setBannerCurrencies(
          (data.bannerCurrencies || "USD,JPY,EUR,GBP,CNY").split(",").filter(Boolean)
        );
      })
      .catch(() => {
        setBannerEnabled(true);
        setBannerCurrencies(["USD", "JPY", "EUR", "GBP", "CNY"]);
      })
      .finally(() => setSettingsLoaded(true));
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      // 배너 설정 통화를 API에 전달하여 포트폴리오 통화 제한 우회
      const params = bannerCurrencies.length > 0
        ? `?currencies=${bannerCurrencies.join(",")}`
        : "";
      const res = await fetch(`/api/exchange-alert/status${params}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.alerts && data.alerts.length > 0) {
        setAllAlerts(data.alerts);
      }
    } catch {
      // 실패 시 기존 데이터 유지
    } finally {
      setLoading(false);
    }
  }, [bannerCurrencies]);

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

  // 설정에 따라 필터링
  useEffect(() => {
    if (bannerCurrencies.length === 0) {
      setFilteredAlerts(allAlerts);
    } else {
      const filtered = bannerCurrencies
        .map((code) => allAlerts.find((a) => a.currency === code))
        .filter((a): a is AlertStatus => a != null);
      setFilteredAlerts(filtered);
    }
  }, [allAlerts, bannerCurrencies]);

  // filteredAlerts가 처음 로드되면 랜덤 시작 인덱스 설정
  const initializedRef = useRef(false);
  useEffect(() => {
    if (filteredAlerts.length > 1 && !initializedRef.current) {
      initializedRef.current = true;
      setCurrentIndex(Math.floor(Math.random() * filteredAlerts.length));
    }
  }, [filteredAlerts.length]);

  useEffect(() => {
    if (isIdle || !settingsLoaded) return; // 대기 모드 또는 설정 미로드 시 폴링 중지

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
  }, [fetchAlerts, isIdle, settingsLoaded]);

  // 아래로 슬라이드 전환 (exit → index 변경 → enter)
  const doSlide = useCallback((getIdx: (prev: number, len: number) => number) => {
    if (animatingRef.current || alertsRef.current.length <= 1) return;
    animatingRef.current = true;
    setPhase("exit");
    setTimeout(() => {
      setCurrentIndex((prev) => getIdx(prev, alertsRef.current.length));
      setPhase("enter");
      setTimeout(() => {
        setPhase("idle");
        animatingRef.current = false;
      }, 300);
    }, 300);
  }, []);

  const slideNext = useCallback(() => {
    doSlide((prev, len) => (prev + 1) % len);
  }, [doSlide]);

  const triggerPrev = useCallback(() => {
    doSlide((prev, len) => (prev - 1 + len) % len);
  }, [doSlide]);

  const triggerGoTo = useCallback((idx: number) => {
    doSlide(() => idx);
  }, [doSlide]);

  // 자동 롤링 인터벌
  useEffect(() => {
    if (filteredAlerts.length <= 1 || isIdle) return;
    const interval = setInterval(slideNext, 5000);
    return () => clearInterval(interval);
  }, [filteredAlerts.length, slideNext, isIdle]);

  const openReport = (currency: string) => {
    setReportOpen(true);
    setReport(null);
    fetchReport(currency);
  };

  // 로딩 중
  if (loading || !settingsLoaded) {
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

  // 배너 비활성화
  if (!bannerEnabled) return null;

  if (filteredAlerts.length === 0) return null;

  const safeIndex = currentIndex % filteredAlerts.length;
  const current = filteredAlerts[safeIndex];
  if (!current) return null;

  const style = TIER_STYLES[current.tier];

  return (
    <>
      {isIdle ? (
        <div className="w-full border-b border-gray-200/60 bg-gray-50/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="h-10 flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Pause className="h-3.5 w-3.5" />
                <span>환율 실시간 업데이트 대기 중</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="hidden sm:inline">화면을 클릭하거나</span>
                <button
                  onClick={fetchAlerts}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <RefreshCw className="h-3 w-3" />
                  새로고침
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "w-full border-b overflow-hidden",
            style.bg,
            style.border,
            style.pulse && "animate-[pulse_3s_ease-in-out_infinite]"
          )}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative h-10 overflow-hidden">
              <button
                onClick={() => openReport(current.currency)}
                className={cn(
                  "absolute inset-0 w-full group cursor-pointer",
                  phase === "exit" && "animate-[bannerExit_300ms_ease-in_forwards]",
                  phase === "enter" && "animate-[bannerEnter_300ms_ease-out]",
                )}
              >
                <BannerItem
                  alert={current}
                  alerts={filteredAlerts}
                  currentIndex={safeIndex}
                  onOpenReport={openReport}
                  onPrev={triggerPrev}
                  onNext={slideNext}
                  onSetIndex={triggerGoTo}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 상세 리포트 다이얼로그 */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-gray-600" />
              {report?.currencyName || current.currencyName} 환율 분석 리포트
            </DialogTitle>
            <DialogDescription>
              기술적 지표 기반 6단계 종합 분석 ({getRateUnit(current.currency)}/KRW)
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
  const signals = deriveSignals(report);

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
                {formatRateDisplay(report.currency, report.currentRate)}
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
                  left: `${Math.max(2, Math.min(97, ((-report.score + 100) / 200) * 100))}%`,
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
          {report.config?.description}
        </p>
      </div>

      {/* 섹션 2: TradingView 차트 */}
      <TradingViewChart currency={report.currency} />

      {/* 섹션 3: 기술적 지표 판정 */}
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
              {signals.map((sig) => (
                <tr key={sig.label} className="hover:bg-gray-50/50">
                  <td className="px-3 py-2.5 font-medium text-gray-700 text-xs">
                    {sig.label}
                  </td>
                  <td className="px-3 py-2.5 text-xs tabular-nums text-gray-600">
                    {sig.value}
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 섹션 4: 최근 20일 캔들 추이 */}
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
                        {formatRateDisplay(report.currency, c.rate)}
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
                          c.bbPos.includes("\u{D558}\u{B2E8}") ? "bg-emerald-100 text-emerald-700" :
                          c.bbPos.includes("\u{C0C1}\u{B2E8}") ? "bg-red-100 text-red-700" :
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

      {/* 섹션 5: 종합 판단 */}
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
                <p className="text-lg font-bold tabular-nums text-gray-800">{20 - report.summary.daysBelow50MA}일</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] text-gray-500">MA50 하회</p>
                <p className="text-lg font-bold tabular-nums text-gray-800">{report.summary.daysBelow50MA}일</p>
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
