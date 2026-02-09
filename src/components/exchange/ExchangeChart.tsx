"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, IChartApi, ISeriesApi, AreaData, Time, AreaSeries } from "lightweight-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

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

      // 차트 데이터 변환
      const chartData: AreaData<Time>[] = history.map((item) => ({
        time: item.date as Time,
        value: item.rate,
      }));

      // 통계 계산
      const rates = history.map((h) => h.rate);
      const current = rates[rates.length - 1];
      const first = rates[0];
      const change = current - first;
      const changePercent = (change / first) * 100;
      const high = Math.max(...rates);
      const low = Math.min(...rates);

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
    const containerHeight = chartContainerRef.current.clientHeight || 450;

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
        const newHeight = chartContainerRef.current.clientHeight || 450;
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
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{currency}/KRW 차트</CardTitle>
          <div className="flex gap-1">
            {PERIODS.map((period) => (
              <Button
                key={period.days}
                variant={selectedPeriod === period.days ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPeriod(period.days)}
              >
                {period.label}
              </Button>
            ))}
          </div>
        </div>

        {/* 통계 정보 */}
        {stats && (
          <div className="flex items-center gap-6 mt-4 text-sm">
            <div>
              <span className="text-muted-foreground">현재가</span>
              <p className="text-xl font-bold tabular-nums">
                {stats.current.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">변동</span>
              <p
                className={`text-lg font-semibold tabular-nums flex items-center gap-1 ${
                  stats.change > 0
                    ? "text-red-500"
                    : stats.change < 0
                    ? "text-blue-500"
                    : "text-muted-foreground"
                }`}
              >
                {stats.change > 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : stats.change < 0 ? (
                  <TrendingDown className="h-4 w-4" />
                ) : (
                  <Minus className="h-4 w-4" />
                )}
                {stats.change > 0 ? "+" : ""}
                {stats.change.toFixed(2)} ({stats.changePercent > 0 ? "+" : ""}
                {stats.changePercent.toFixed(2)}%)
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">최고</span>
              <p className="text-lg font-semibold tabular-nums text-red-500">
                {stats.high.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">최저</span>
              <p className="text-lg font-semibold tabular-nums text-blue-500">
                {stats.low.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {loading && !stats && (
          <div className="h-[450px] flex items-center justify-center">
            <div className="text-muted-foreground">차트 로딩 중...</div>
          </div>
        )}

        {error && (
          <div className="h-[450px] flex items-center justify-center">
            <div className="text-destructive">{error}</div>
          </div>
        )}

        <div
          ref={chartContainerRef}
          style={{ height: "450px", width: "100%", minHeight: "400px" }}
          className={`${loading && !stats ? "hidden" : ""} ${error ? "hidden" : ""}`}
        />
      </CardContent>
    </Card>
  );
}
