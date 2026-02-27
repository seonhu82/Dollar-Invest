/**
 * Exchange Rate Alert Engine - 6-Tier Signal System
 *
 * 학술적 근거 기반 복합 기술적 지표 분석 엔진
 *
 * 6단계 신호 체계:
 *   STRONG_SELL (적극 매도) → SELL (매도) → NEUTRAL (관망)
 *   → WATCH (관심) → BUY (매수) → STRONG_BUY (적극 매수)
 *
 * 복합 스코어링 시스템 (총 ±100점):
 *   1. 추세 위치 (MA50 기준) - ±30점
 *   2. 모멘텀 (CCI-20) - ±25점
 *   3. 강도 (RSI-14) - ±25점
 *   4. 변동성 위치 (BB-20,2) - ±20점
 *
 * 통화별 특성 반영:
 *   - USD: 기축통화, 표준 임계값 (가장 유동적, 안정적)
 *   - EUR: USD와 유사, ECB 정책 영향 (약간 넓은 CCI 상한)
 *   - JPY: 안전자산, BOJ 정책 레짐 전환 (넓은 임계값, 비대칭 변동성)
 *   - GBP: 높은 변동성, BoE 정책 영향 (가장 넓은 임계값)
 *   - CNY: 관리변동환율제, PBOC 개입 (좁은 임계값)
 *
 * 참조:
 *   - CCI ±100 표준 과매수/과매도 기준 (Fidelity, Lambert 1980)
 *   - RSI 변동성 조정: 고변동 75/25, 저변동 35/65 (Wilder 1978)
 *   - BB %B: 0.2 이하 과매도, 0.8 이상 과매수 (Bollinger 2001)
 *   - JPY 안전자산 특성 (ScienceDirect: Time-variant safe haven currencies)
 *   - 복합지표 3개 이상 동시확인 시 신뢰도 향상 (Multi-Indicator Composite Decision Systems)
 */

import { getExchangeRateHistory } from "./exchange";

// ========== Types ==========

export type SignalTier =
  | "STRONG_SELL"
  | "SELL"
  | "NEUTRAL"
  | "WATCH"
  | "BUY"
  | "STRONG_BUY";

export interface CurrencyConfig {
  name: string;
  symbol: string;
  // CCI 임계값 (Commodity Channel Index, Lambert 1980)
  // 표준: ±100 과매수/과매도, ±150 극단적
  // 통화별 변동성에 따라 조정 (자산별 반전 포인트 상이)
  cciOversold: number;
  cciExtremeOversold: number;
  cciOverbought: number;
  cciExtremeOverbought: number;
  // RSI 임계값 (Relative Strength Index, Wilder 1978)
  // 표준: 30/70, 변동성 조정: 고변동 25/75, 저변동 35/65
  rsiOversold: number;
  rsiExtremeOversold: number;
  rsiOverbought: number;
  rsiExtremeOverbought: number;
  // 추세 민감도 (MA50 대비 %편차에 적용하는 승수)
  // 1.0 = 표준, >1.0 = 작은 편차에도 민감 반응
  trendSensitivity: number;
  description: string;
}

export interface ScoreBreakdown {
  trend: number;
  momentum: number;
  strength: number;
  volatility: number;
}

export interface AlertStatus {
  currency: string;
  currencyName: string;
  tier: SignalTier;
  tierLabel: string;
  score: number;
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
  isActive: boolean;
  lastCheckedAt: string;
  scoreBreakdown: ScoreBreakdown;
}

export interface RecentCandle {
  date: string;
  rate: number;
  cci: number;
  rsi: number;
  bbPercent: number;
  bbPos: string;
  ma50: number;
}

export interface AlertSummary {
  daysBelow50MA: number;
  low20D: number;
  high20D: number;
  bbWidthPct: number;
  trendDir: string;
  analysis: string;
}

export interface AlertReport extends AlertStatus {
  recentCandles: RecentCandle[];
  summary: AlertSummary;
  config: CurrencyConfig;
}

// ========== 통화별 설정 ==========
// 각 통화의 변동성 프로필과 시장 특성에 맞춘 임계값 설정

export const CURRENCY_CONFIGS: Record<string, CurrencyConfig> = {
  USD: {
    name: "미국 달러",
    symbol: "$",
    // 가장 유동적이고 안정적인 통화. 표준 임계값 적용.
    cciOversold: -100,
    cciExtremeOversold: -150,
    cciOverbought: 100,
    cciExtremeOverbought: 150,
    rsiOversold: 30,
    rsiExtremeOversold: 25,
    rsiOverbought: 70,
    rsiExtremeOverbought: 75,
    trendSensitivity: 1.0,
    description:
      "기축통화. 미국 연준(Fed) 금리 정책과 경제지표에 민감. 가장 유동성이 높고 안정적.",
  },
  EUR: {
    name: "유로",
    symbol: "\u20ac",
    // USD와 유사하나 ECB 정책 불확실성으로 극단 CCI 약간 확대
    cciOversold: -100,
    cciExtremeOversold: -155,
    cciOverbought: 100,
    cciExtremeOverbought: 155,
    rsiOversold: 30,
    rsiExtremeOversold: 25,
    rsiOverbought: 70,
    rsiExtremeOverbought: 75,
    trendSensitivity: 1.0,
    description:
      "유로존 19개국 공통 통화. ECB 통화정책에 연동. USD와 역상관 경향.",
  },
  JPY: {
    name: "일본 엔",
    symbol: "\u00a5",
    // 안전자산 통화 - 가장 강한 안전자산 특성 (ScienceDirect 연구)
    // BOJ 정책 레짐 전환 시 급변 → 넓은 임계값으로 거짓 신호 방지
    // RSI: 28/72 (비대칭적 변동성 반영)
    // 추세 민감도 1.2: JPY/KRW 환율 변동폭이 작아 작은 편차에도 반응
    cciOversold: -110,
    cciExtremeOversold: -165,
    cciOverbought: 110,
    cciExtremeOverbought: 165,
    rsiOversold: 28,
    rsiExtremeOversold: 23,
    rsiOverbought: 72,
    rsiExtremeOverbought: 77,
    trendSensitivity: 1.2,
    description:
      "안전자산 통화. 글로벌 위험회피 시 급등. BOJ 정책과 금리차에 민감. 비대칭적 변동성 주의.",
  },
  GBP: {
    name: "영국 파운드",
    symbol: "\u00a3",
    // 주요 통화 중 가장 높은 변동성
    // 넓은 임계값으로 잦은 거짓 신호 방지
    cciOversold: -115,
    cciExtremeOversold: -170,
    cciOverbought: 115,
    cciExtremeOverbought: 170,
    rsiOversold: 28,
    rsiExtremeOversold: 22,
    rsiOverbought: 72,
    rsiExtremeOverbought: 78,
    trendSensitivity: 0.9,
    description:
      "높은 변동성. BoE 정책과 영국 경제지표에 민감. 정치적 이벤트에 큰 반응.",
  },
  CNY: {
    name: "중국 위안",
    symbol: "\u00a5",
    // 관리변동환율제 - PBOC가 일일 기준환율 설정
    // 좁은 임계값: 작은 변동도 의미 있는 신호 (정책 주도 시장)
    // RSI: 35/65 (제한된 변동폭 반영)
    // 추세 민감도 1.3: 작은 편차가 정책 변화 시그널일 수 있음
    cciOversold: -85,
    cciExtremeOversold: -130,
    cciOverbought: 85,
    cciExtremeOverbought: 130,
    rsiOversold: 35,
    rsiExtremeOversold: 28,
    rsiOverbought: 65,
    rsiExtremeOverbought: 72,
    trendSensitivity: 1.3,
    description:
      "관리변동환율제. PBOC 일일 기준환율 설정. 정책 리스크 높지만 변동폭 제한적.",
  },
};

// ========== 신호 단계 정보 ==========

export interface TierInfo {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  description: string;
}

export const TIER_INFO: Record<SignalTier, TierInfo> = {
  STRONG_SELL: {
    label: "적극 매도",
    color: "bg-red-600",
    bgColor: "bg-red-50/90",
    borderColor: "border-red-200/80",
    textColor: "text-red-700",
    description:
      "환율이 극과매수 상태입니다. 보유 외화 매도를 적극 고려하세요.",
  },
  SELL: {
    label: "매도",
    color: "bg-orange-500",
    bgColor: "bg-orange-50/90",
    borderColor: "border-orange-200/80",
    textColor: "text-orange-700",
    description: "환율이 과매수 영역입니다. 보유 외화 매도를 검토하세요.",
  },
  NEUTRAL: {
    label: "관망",
    color: "bg-gray-400",
    bgColor: "bg-gray-50/90",
    borderColor: "border-gray-200/80",
    textColor: "text-gray-600",
    description: "뚜렷한 방향성이 없습니다. 관망하며 추이를 지켜보세요.",
  },
  WATCH: {
    label: "관심",
    color: "bg-blue-500",
    bgColor: "bg-blue-50/90",
    borderColor: "border-blue-200/80",
    textColor: "text-blue-700",
    description:
      "환율 하락 초기 신호입니다. 매수 시점을 모니터링하세요.",
  },
  BUY: {
    label: "매수",
    color: "bg-lime-500",
    bgColor: "bg-lime-50/90",
    borderColor: "border-lime-200/80",
    textColor: "text-lime-700",
    description: "환율이 과매도 영역입니다. 외화 매수를 검토하세요.",
  },
  STRONG_BUY: {
    label: "적극 매수",
    color: "bg-green-600",
    bgColor: "bg-green-50/90",
    borderColor: "border-green-200/80",
    textColor: "text-green-700",
    description:
      "환율이 극과매도 상태입니다. 외화 매수를 적극 고려하세요.",
  },
};

// ========== 기술적 지표 계산 ==========

/**
 * SMA (Simple Moving Average) - 단순이동평균
 * 지정 기간의 종가 평균. 추세 방향 판단의 기초.
 */
function calculateSMA(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(0);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += values[j];
    }
    result.push(sum / period);
  }
  return result;
}

/**
 * CCI (Commodity Channel Index) - 상품채널지수
 * Lambert(1980) 개발. 과매수/과매도 및 추세 강도 측정.
 *
 * 일반적 TP = (H+L+C)/3 이지만, 종가만 사용 시 TP = C로 근사.
 * Close-only CCI는 실무에서 널리 사용되는 변형 (Quantified Strategies).
 *
 * CCI = (TP - SMA(TP, n)) / (0.015 x Mean Deviation)
 * 0.015 상수: Lambert가 값의 ~75%가 ±100 내에 분포하도록 설계.
 */
function calculateCCI(closes: number[], period: number = 20): number[] {
  const result: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(0);
      continue;
    }
    const slice = closes.slice(i - period + 1, i + 1);
    const tp = slice[slice.length - 1];
    const tpMean = slice.reduce((a, b) => a + b, 0) / period;
    const meanDev =
      slice.reduce((sum, v) => sum + Math.abs(v - tpMean), 0) / period;
    result.push(meanDev === 0 ? 0 : (tp - tpMean) / (0.015 * meanDev));
  }
  return result;
}

/**
 * RSI (Relative Strength Index) - 상대강도지수
 * Wilder(1978) 개발. 가격 모멘텀의 속도와 크기 측정.
 *
 * 첫 RSI는 단순 평균, 이후 지수이동평균(Wilder's smoothing) 사용.
 * 변동성 조정: 고변동 통화 25/75, 저변동 35/65 (AdmiralMarkets 연구)
 */
function calculateRSI(closes: number[], period: number = 14): number[] {
  const result: number[] = [];
  if (closes.length < 2) return [0];

  const gains: number[] = [0];
  const losses: number[] = [0];

  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  result.push(0); // index 0

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i < closes.length; i++) {
    if (i < period) {
      result.push(0);
      continue;
    }

    if (i === period) {
      // 첫 번째 RSI: 단순 평균
      avgGain =
        gains.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
      avgLoss =
        losses.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
    } else {
      // 이후: Wilder's smoothing (지수이동평균)
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    }

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }

  return result;
}

/**
 * Bollinger Bands - 볼린저 밴드
 * Bollinger(2001) 개발. 가격의 상대적 고저를 변동성 기반으로 판단.
 *
 * 중간선 = SMA(종가, 20)
 * 상단 = 중간선 + 2 x 표준편차
 * 하단 = 중간선 - 2 x 표준편차
 *
 * %B = (가격 - 하단) / (상단 - 하단)
 * %B > 0.8: 과매수 근접, %B < 0.2: 과매도 근접 (StockCharts)
 */
function calculateBB(
  closes: number[],
  period: number = 20,
  multiplier: number = 2.0
) {
  const middle = calculateSMA(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(0);
      lower.push(0);
      continue;
    }
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = middle[i];
    const variance =
      slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period;
    const stdDev = Math.sqrt(variance);
    upper.push(mean + multiplier * stdDev);
    lower.push(mean - multiplier * stdDev);
  }

  return { upper, middle, lower };
}

// ========== 스코어링 시스템 ==========

/**
 * 구간 보간 함수 - 연속적인 스코어 계산
 * points: [입력값, 출력값] 정렬 배열
 * 입력값이 두 점 사이에 있으면 선형 보간
 */
function interpolate(value: number, points: [number, number][]): number {
  if (value <= points[0][0]) return points[0][1];
  if (value >= points[points.length - 1][0])
    return points[points.length - 1][1];

  for (let i = 1; i < points.length; i++) {
    if (value <= points[i][0]) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      const t = (value - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return points[points.length - 1][1];
}

/**
 * 복합 스코어 계산
 *
 * 양수(+) = 외화 매수 유리 (환율 하락/과매도)
 * 음수(-) = 외화 매도 유리 (환율 상승/과매수)
 *
 * 4개 지표의 독립적 스코어를 합산하여 최종 판정:
 *   - 추세 위치(MA50): 환율이 MA50 대비 어디에 위치하는가? (±30)
 *   - 모멘텀(CCI): 가격 변화의 속도와 방향은? (±25)
 *   - 강도(RSI): 상승/하락 모멘텀의 강도는? (±25)
 *   - 변동성 위치(BB): 밴드 내 어디에 위치하는가? (±20)
 */
function calculateCompositeScore(
  rate: number,
  ma50: number,
  cci: number,
  rsi: number,
  bbUpper: number,
  bbLower: number,
  config: CurrencyConfig
): { total: number; breakdown: ScoreBreakdown } {
  // 1. 추세 위치 (±30점 max)
  // MA50 대비 % 편차에 통화별 민감도 적용
  // 환율 < MA50: 양수 (외화 약세 = 매수 유리)
  // 환율 > MA50: 음수 (외화 강세 = 매도 유리)
  const pctFromMA50 =
    ma50 > 0
      ? ((rate - ma50) / ma50) * 100 * config.trendSensitivity
      : 0;
  const trend = interpolate(pctFromMA50, [
    [-3, 30],
    [-1.5, 20],
    [-0.5, 8],
    [0, 0],
    [0.5, -8],
    [1.5, -20],
    [3, -30],
  ]);

  // 2. 모멘텀 CCI (±25점 max)
  // CCI < 과매도 임계값: 양수 (매수 모멘텀)
  // CCI > 과매수 임계값: 음수 (매도 모멘텀)
  const momentum = interpolate(cci, [
    [config.cciExtremeOversold, 25],
    [config.cciOversold, 15],
    [0, 0],
    [config.cciOverbought, -15],
    [config.cciExtremeOverbought, -25],
  ]);

  // 3. 강도 RSI (±25점 max)
  // RSI 50을 중심으로 과매도/과매수 판단
  const strength = interpolate(rsi, [
    [config.rsiExtremeOversold, 25],
    [config.rsiOversold, 15],
    [50, 0],
    [config.rsiOverbought, -15],
    [config.rsiExtremeOverbought, -25],
  ]);

  // 4. 변동성 위치 BB %B (±20점 max)
  // %B < 0.2: 하단 근접 = 과매도 (양수)
  // %B > 0.8: 상단 근접 = 과매수 (음수)
  const bbRange = bbUpper - bbLower;
  const bbPct = bbRange > 0 ? (rate - bbLower) / bbRange : 0.5;
  const volatility = interpolate(bbPct, [
    [-0.1, 20],
    [0.2, 10],
    [0.5, 0],
    [0.8, -10],
    [1.1, -20],
  ]);

  const total =
    Math.round((trend + momentum + strength + volatility) * 10) / 10;

  return {
    total,
    breakdown: {
      trend: Math.round(trend * 10) / 10,
      momentum: Math.round(momentum * 10) / 10,
      strength: Math.round(strength * 10) / 10,
      volatility: Math.round(volatility * 10) / 10,
    },
  };
}

/**
 * 스코어 → 6단계 신호 매핑
 *
 * 경계값 설계 근거:
 *   - STRONG_BUY(>55): 4개 지표 대부분 매수 방향 → 강한 확신
 *   - BUY(>25): 2-3개 지표 매수 방향 → 중간 확신
 *   - WATCH(>5): 약한 매수 신호 → 모니터링 권고
 *   - NEUTRAL(-15~5): 방향성 없음 → 관망
 *   - SELL(<-15): 2-3개 지표 매도 방향
 *   - STRONG_SELL(<-45): 대부분 매도 방향 → 적극 매도
 *
 * 매수 구간이 더 세분화된 이유: 달러 투자앱 특성상
 * 매수 타이밍 판단이 핵심 유스케이스이므로 3단계(WATCH→BUY→STRONG_BUY)로 분리
 */
function determineTier(score: number): SignalTier {
  if (score > 55) return "STRONG_BUY";
  if (score > 25) return "BUY";
  if (score > 5) return "WATCH";
  if (score > -15) return "NEUTRAL";
  if (score > -45) return "SELL";
  return "STRONG_SELL";
}

// ========== 시장 시간 판단 ==========

function isFXMarketOpen(): boolean {
  const now = new Date();
  const kst = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );
  const day = kst.getDay();
  const timeMinutes = kst.getHours() * 60 + kst.getMinutes();

  // 한국 FX시장: 월~금 09:00~15:30 KST
  if (day === 0 || day === 6) return false;
  return timeMinutes >= 540 && timeMinutes <= 930;
}

// ========== 캐시 ==========

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const statusCacheMap = new Map<string, CacheEntry<AlertStatus>>();
const reportCacheMap = new Map<string, CacheEntry<AlertReport>>();
const CACHE_TTL = 30 * 60 * 1000; // 30분

// ========== 분석 함수 (외부 노출) ==========

/**
 * 배너용 상태 조회 - 경량 응답 (캔들/요약 제외)
 * 5분마다 클라이언트 폴링 대응
 */
export async function analyzeStatus(
  currencies: string[]
): Promise<AlertStatus[]> {
  const results: AlertStatus[] = [];
  const needsFetch: string[] = [];

  // 캐시 확인
  for (const currency of currencies) {
    const cached = statusCacheMap.get(currency);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      results.push({ ...cached.data, isActive: isFXMarketOpen() });
    } else {
      needsFetch.push(currency);
    }
  }

  // 캐시 미스 통화만 분석 (병렬)
  if (needsFetch.length > 0) {
    const freshResults = await Promise.allSettled(
      needsFetch.map((c) => analyzeCurrency(c, false))
    );

    for (let i = 0; i < needsFetch.length; i++) {
      const result = freshResults[i];
      if (result.status === "fulfilled" && result.value) {
        const status = result.value as AlertStatus;
        statusCacheMap.set(needsFetch[i], {
          data: status,
          timestamp: Date.now(),
        });
        results.push(status);
      }
    }
  }

  return results;
}

/**
 * 리포트용 상세 분석 - 다이얼로그 열 때만 호출
 * 최근 20일 캔들 + 요약 통계 포함
 */
export async function analyzeReport(
  currency: string
): Promise<AlertReport | null> {
  const cached = reportCacheMap.get(currency);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { ...cached.data, isActive: isFXMarketOpen() };
  }

  const report = (await analyzeCurrency(currency, true)) as AlertReport | null;
  if (report) {
    reportCacheMap.set(currency, { data: report, timestamp: Date.now() });
  }
  return report;
}

// ========== 핵심 분석 로직 ==========

async function analyzeCurrency(
  currency: string,
  includeReport: boolean
): Promise<AlertStatus | AlertReport | null> {
  const config = CURRENCY_CONFIGS[currency];
  if (!config) return null;

  // MA50 안정 계산을 위해 120일 히스토리 필요
  const history = await getExchangeRateHistory(currency, 120);

  if (!history || history.length < 50) {
    console.log(
      `Insufficient data for ${currency}: ${history?.length || 0} days (need 50+)`
    );
    return null;
  }

  const closes = history.map((h) => h.rate);
  const dates = history.map((h) => h.date);

  // 지표 계산
  const ma50Array = calculateSMA(closes, 50);
  const ma20Array = calculateSMA(closes, 20);
  const cciArray = calculateCCI(closes, 20);
  const rsiArray = calculateRSI(closes, 14);
  const bb = calculateBB(closes, 20, 2.0);

  const lastIdx = closes.length - 1;
  const prevIdx = lastIdx - 1;

  const currentRate = closes[lastIdx];
  const previousClose = prevIdx >= 0 ? closes[prevIdx] : currentRate;
  const ma50 = ma50Array[lastIdx];
  const ma20 = ma20Array[lastIdx];
  const cci = cciArray[lastIdx];
  const rsi = rsiArray[lastIdx];
  const bbUpper = bb.upper[lastIdx];
  const bbMiddle = bb.middle[lastIdx];
  const bbLower = bb.lower[lastIdx];

  const bbRange = bbUpper - bbLower;
  const bbPercent = bbRange > 0 ? (currentRate - bbLower) / bbRange : 0.5;

  const changePercent =
    previousClose > 0
      ? Math.round(
          ((currentRate - previousClose) / previousClose) * 10000
        ) / 100
      : 0;

  // 복합 스코어 계산 및 신호 판정
  const { total, breakdown } = calculateCompositeScore(
    currentRate,
    ma50,
    cci,
    rsi,
    bbUpper,
    bbLower,
    config
  );
  const tier = determineTier(total);

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const round1 = (n: number) => Math.round(n * 10) / 10;

  const status: AlertStatus = {
    currency,
    currencyName: config.name,
    tier,
    tierLabel: TIER_INFO[tier].label,
    score: total,
    currentRate: round2(currentRate),
    previousClose: round2(previousClose),
    changePercent,
    cci: round1(cci),
    rsi: round1(rsi),
    bbUpper: round2(bbUpper),
    bbMiddle: round2(bbMiddle),
    bbLower: round2(bbLower),
    bbPercent: Math.round(bbPercent * 1000) / 1000,
    ma50: round2(ma50),
    ma20: round2(ma20),
    isActive: isFXMarketOpen(),
    lastCheckedAt: new Date().toISOString(),
    scoreBreakdown: breakdown,
  };

  if (!includeReport) return status;

  // ========== 리포트 데이터 ==========

  // 최근 20일 캔들 + 지표
  const startIdx = Math.max(0, lastIdx - 19);
  const recentCandles: RecentCandle[] = [];

  for (let i = startIdx; i <= lastIdx; i++) {
    const bbRangeI = bb.upper[i] - bb.lower[i];
    const bbPctI =
      bbRangeI > 0 ? (closes[i] - bb.lower[i]) / bbRangeI : 0.5;

    let bbPos: string;
    if (bbPctI > 0.8) bbPos = "상단\u2191";
    else if (bbPctI > 0.6) bbPos = "중간\u2191";
    else if (bbPctI > 0.4) bbPos = "중간";
    else if (bbPctI > 0.2) bbPos = "중간\u2193";
    else bbPos = "하단\u2193";

    recentCandles.push({
      date: dates[i],
      rate: round2(closes[i]),
      cci: round1(cciArray[i]),
      rsi: round1(rsiArray[i]),
      bbPercent: Math.round(bbPctI * 1000) / 1000,
      bbPos,
      ma50: round2(ma50Array[i]),
    });
  }

  // 요약 통계
  const recent20Closes = closes.slice(startIdx, lastIdx + 1);
  const daysBelow50MA = recentCandles.filter(
    (c) => c.rate < c.ma50
  ).length;
  const low20D = Math.min(...recent20Closes);
  const high20D = Math.max(...recent20Closes);
  const bbWidthPct =
    bbMiddle > 0
      ? Math.round(((bbUpper - bbLower) / bbMiddle) * 10000) / 100
      : 0;

  let trendDir: string;
  if (currentRate < ma50) {
    trendDir =
      ma20 < ma50
        ? `${config.name} 약세 (하락추세)`
        : `${config.name} 약세 전환 중`;
  } else {
    trendDir =
      ma20 > ma50
        ? `${config.name} 강세 (상승추세)`
        : `${config.name} 강세 전환 중`;
  }

  const analysis = generateAnalysis(status, config);

  const report: AlertReport = {
    ...status,
    recentCandles,
    summary: {
      daysBelow50MA,
      low20D: round2(low20D),
      high20D: round2(high20D),
      bbWidthPct,
      trendDir,
      analysis,
    },
    config,
  };

  return report;
}

// ========== 종합 분석 텍스트 생성 ==========

function generateAnalysis(
  status: AlertStatus,
  config: CurrencyConfig
): string {
  const { tier, currentRate, ma50, cci, rsi, bbPercent, score } = status;
  const parts: string[] = [];

  // 추세 분석
  if (currentRate < ma50) {
    const pct = Math.abs(((currentRate - ma50) / ma50) * 100).toFixed(1);
    parts.push(
      `${config.name}/원 환율이 50일 이동평균(${ma50.toFixed(2)}) 대비 ${pct}% 하회 중입니다.`
    );
  } else {
    const pct = (((currentRate - ma50) / ma50) * 100).toFixed(1);
    parts.push(
      `${config.name}/원 환율이 50일 이동평균(${ma50.toFixed(2)}) 대비 ${pct}% 상회 중입니다.`
    );
  }

  // CCI 분석
  if (cci < config.cciExtremeOversold) {
    parts.push(
      `CCI(${cci.toFixed(1)})가 극과매도 영역(${config.cciExtremeOversold} 이하)에 진입했습니다. 반등 가능성이 높습니다.`
    );
  } else if (cci < config.cciOversold) {
    parts.push(
      `CCI(${cci.toFixed(1)})가 과매도 영역(${config.cciOversold} 이하)에 진입했습니다.`
    );
  } else if (cci > config.cciExtremeOverbought) {
    parts.push(
      `CCI(${cci.toFixed(1)})가 극과매수 영역(${config.cciExtremeOverbought} 이상)에 진입했습니다. 조정 가능성이 높습니다.`
    );
  } else if (cci > config.cciOverbought) {
    parts.push(
      `CCI(${cci.toFixed(1)})가 과매수 영역(${config.cciOverbought} 이상)에 진입했습니다.`
    );
  }

  // RSI 분석
  if (rsi < config.rsiOversold) {
    parts.push(
      `RSI(${rsi.toFixed(1)})가 과매도 영역으로 기술적 반등 가능성이 있습니다.`
    );
  } else if (rsi > config.rsiOverbought) {
    parts.push(
      `RSI(${rsi.toFixed(1)})가 과매수 영역으로 기술적 조정 가능성이 있습니다.`
    );
  }

  // BB 분석
  if (bbPercent < 0.1) {
    parts.push(
      "볼린저밴드 하단을 이탈하여 극단적 과매도 상태입니다."
    );
  } else if (bbPercent < 0.2) {
    parts.push("볼린저밴드 하단에 근접하여 반등이 예상됩니다.");
  } else if (bbPercent > 0.9) {
    parts.push(
      "볼린저밴드 상단을 이탈하여 극단적 과매수 상태입니다."
    );
  } else if (bbPercent > 0.8) {
    parts.push("볼린저밴드 상단에 근접하여 조정이 예상됩니다.");
  }

  // 종합 판정
  parts.push(
    `종합 점수 ${score.toFixed(1)}점으로 "${TIER_INFO[tier].label}" 판정입니다.`
  );

  // 통화별 특성 주의사항
  if (currency_is(config, "JPY")) {
    parts.push(
      "\u203b 엔화는 안전자산 특성으로 글로벌 불확실성 확대 시 급격한 변동 가능성에 유의하세요."
    );
  } else if (currency_is(config, "CNY")) {
    parts.push(
      "\u203b 위안화는 관리변동환율제로 PBOC 정책 변화에 따른 급변 가능성에 유의하세요."
    );
  } else if (currency_is(config, "GBP")) {
    parts.push(
      "\u203b 파운드는 변동성이 높아 급격한 추세 전환 가능성에 유의하세요."
    );
  }

  return parts.join(" ");
}

function currency_is(config: CurrencyConfig, code: string): boolean {
  return config === CURRENCY_CONFIGS[code];
}
