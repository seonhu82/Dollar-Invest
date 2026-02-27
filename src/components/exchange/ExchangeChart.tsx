"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, IChartApi, ISeriesApi, AreaData, Time, AreaSeries } from "lightweight-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Minus, ExternalLink } from "lucide-react";
import { getDisplayRate, getRateUnit } from "@/lib/utils";

const TV_SYMBOLS: Record<string, string> = {
  USD: "FX_IDC:USDKRW",
  EUR: "FX_IDC:EURKRW",
  JPY: "FX_IDC:JPYKRW",
  GBP: "FX_IDC:GBPKRW",
  CNY: "FX_IDC:CNYKRW",
};

interface HistoryData {
  date: string;
  rate: number;
}

interface ExchangeChartProps {
  currency?: string;
  className?: string;
}

const PERIODS = [
  { label: "1주", days: 7 },
  { label: "1개월", days: 30 },
  { label: "3개월", days: 90 },
  { label: "6개월", days: 180 },
  { label: "1년", days: 365 },
];

export function ExchangeChart({ currency = "USD", className }: ExchangeChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area", Time> | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState(30);
  const [stats, setStats] = useState<{
    current: number;
    change: number;
    changePercent: number;
    high: number;
    low: number;
  } | null>(null);

  // 차트 데이터 로드
  const fetchHistory = async (days: number) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/exchange/history?currency=${currency}&days=${days}`);
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const history: HistoryData[] = data.history || [];

      if (history.length === 0) {
        setError("데이터가 없습니다.");
        setLoading(false);
        return;
      }

      // 차트 데이터 변환 (JPY는 100엔당으로 표시)
      const chartData: AreaData<Time>[] = history.map((item) => ({
        time: item.date as Time,
        value: getDisplayRate(currency, item.rate),
      }));

      // 통계 계산 (JPY는 100엔당으로 표시)
      const displayRates = history.map((h) => getDisplayRate(currency, h.rate));
      const current = displayRates[displayRates.length - 1];
      const first = displayRates[0];
      const change = current - first;
      const changePercent = (change / first) * 100;
      const high = Math.max(...displayRates);
      const low = Math.min(...displayRates);

      setStats({ current, change, changePercent, high, low });

      // 차트 업데이트
      if (seriesRef.current) {
        seriesRef.current.setData(chartData);
        chartRef.current?.timeScale().fitContent();
      }
    } catch (err) {
      console.error("환율 히스토리 로드 오류:", err);
      setError("데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 차트 초기화
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 컨테이너 크기 확인
    const containerWidth = chartContainerRef.current.clientWidth || chartContainerRef.current.offsetWidth || 800;
    const containerHeight = chartContainerRef.current.clientHeight || 350;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#9CA3AF",
      },
      grid: {
        vertLines: { color: "#E5E7EB", style: 1 },
        horzLines: { color: "#E5E7EB", style: 1 },
      },
      width: containerWidth,
      height: containerHeight,
      autoSize: true,
      rightPriceScale: {
        borderColor: "#E5E7EB",
      },
      timeScale: {
        borderColor: "#E5E7EB",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: "#6B7280",
          width: 1,
          style: 2,
          labelBackgroundColor: "#374151",
        },
        horzLine: {
          color: "#6B7280",
          width: 1,
          style: 2,
          labelBackgroundColor: "#374151",
        },
      },
    });

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: "#3B82F6",
      topColor: "rgba(59, 130, 246, 0.4)",
      bottomColor: "rgba(59, 130, 246, 0.0)",
      lineWidth: 2,
      priceFormat: {
        type: "price",
        precision: 2,
        minMove: 0.01,
      },
    });

    chartRef.current = chart;
    seriesRef.current = areaSeries;

    // 리사이즈 핸들러
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        const newWidth = chartContainerRef.current.clientWidth || chartContainerRef.current.offsetWidth || 800;
        const newHeight = chartContainerRef.current.clientHeight || 350;
        chartRef.current.applyOptions({ width: newWidth, height: newHeight });
        chartRef.current.timeScale().fitContent();
      }
    };

    window.addEventListener("resize", handleResize);

    // 약간의 딜레이 후 초기 데이터 로드 (DOM 렌더링 완료 대기)
    const timer = setTimeout(() => {
      fetchHistory(selectedPeriod);
    }, 100);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency]);

  // 기간 변경 시 데이터 다시 로드
  useEffect(() => {
    if (chartRef.current) {
      fetchHistory(selectedPeriod);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod]);

  return (
    <Card className={`overflow-hidden ${className || ""}`}>
      <CardHeader className="pb-3">
        {/* 타이틀 + 기간 버튼: 모바일에서 세로 정렬 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            {getRateUnit(currency)}/KRW 차트
            <a
              href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(TV_SYMBOLS[currency] || TV_SYMBOLS.USD)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-normal text-blue-500 hover:text-blue-700 transition-colors"
            >
              TradingView <ExternalLink className="h-3 w-3" />
            </a>
          </CardTitle>
          <div className="flex gap-1 flex-wrap">
            {PERIODS.map((period) => (
              <Button
                key={period.days}
                variant={selectedPeriod === period.days ? "default" : "outline"}
                size="sm"
                className="h-7 px-2 text-xs sm:h-8 sm:px-3 sm:text-sm"
                onClick={() => setSelectedPeriod(period.days)}
              >
                {period.label}
              </Button>
            ))}
          </div>
        </div>

        {/* 통계 정보: 모바일에서 2x2 그리드 */}
        {stats && (
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-3 sm:gap-6 mt-3 text-sm">
            <div className="min-w-0">
              <span className="text-xs text-muted-foreground">현재가</span>
              <p className="text-lg sm:text-xl font-bold tabular-nums truncate">
                {stats.current.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="min-w-0">
              <span className="text-xs text-muted-foreground">변동</span>
              <p
                className={`text-sm sm:text-lg font-semibold tabular-nums flex items-center gap-1 ${
                  stats.change > 0
                    ? "text-red-500"
                    : stats.change < 0
                    ? "text-blue-500"
                    : "text-muted-foreground"
                }`}
              >
                {stats.change > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                ) : stats.change < 0 ? (
                  <TrendingDown className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <Minus className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="truncate">
                  {stats.change > 0 ? "+" : ""}
                  {stats.change.toFixed(2)} ({stats.changePercent > 0 ? "+" : ""}
                  {stats.changePercent.toFixed(2)}%)
                </span>
              </p>
            </div>
            <div className="min-w-0">
              <span className="text-xs text-muted-foreground">최고</span>
              <p className="text-sm sm:text-lg font-semibold tabular-nums text-red-500 truncate">
                {stats.high.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="min-w-0">
              <span className="text-xs text-muted-foreground">최저</span>
              <p className="text-sm sm:text-lg font-semibold tabular-nums text-blue-500 truncate">
                {stats.low.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {loading && !stats && (
          <div className="h-[300px] sm:h-[350px] flex items-center justify-center">
            <div className="text-muted-foreground">차트 로딩 중...</div>
          </div>
        )}

        {error && (
          <div className="h-[300px] sm:h-[350px] flex items-center justify-center">
            <div className="text-destructive">{error}</div>
          </div>
        )}

        <div
          ref={chartContainerRef}
          style={{ height: "350px", width: "100%", minHeight: "280px" }}
          className={`${loading && !stats ? "hidden" : ""} ${error ? "hidden" : ""}`}
        />
      </CardContent>
    </Card>
  );
}
