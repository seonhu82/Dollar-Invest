/**
 * 환율 API 서비스
 *
 * 데이터 소스:
 * 1. 한국수출입은행 Open API (primary) - 공식 환율
 * 2. ExchangeRate-API (fallback) - 무료 백업
 */

import { prisma } from "./prisma";

export interface ExchangeRateData {
  currency: string;
  currencyName: string;
  rate: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  timestamp: string;
}

// 메모리 캐시 (5분)
let rateCache: { data: ExchangeRateData[]; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5분

// 지원 통화
const SUPPORTED_CURRENCIES = ["USD", "EUR", "JPY", "CNY", "GBP"];

/**
 * 한국수출입은행 API에서 환율 조회
 * https://www.koreaexim.go.kr/ir/HPHKIR020M01?apino=2&viewtype=C
 */
async function fetchFromKoreaExim(): Promise<ExchangeRateData[] | null> {
  const apiKey = process.env.KOREA_EXIM_API_KEY;

  if (!apiKey) {
    console.log("한국수출입은행 API 키가 설정되지 않았습니다.");
    return null;
  }

  try {
    // 오늘 날짜 (YYYYMMDD 형식)
    const today = new Date();
    const searchDate = today.toISOString().split("T")[0].replace(/-/g, "");

    const url = `https://www.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey=${apiKey}&searchdate=${searchDate}&data=AP01`;

    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 300 }, // 5분 캐시
    });

    if (!response.ok) {
      throw new Error(`API 응답 오류: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      // 주말/공휴일에는 데이터가 없을 수 있음
      console.log("한국수출입은행: 오늘 환율 데이터 없음 (주말/공휴일)");
      return null;
    }

    // 어제 환율 가져오기 (변동률 계산용)
    const yesterdayRates = await getYesterdayRates();

    const rates: ExchangeRateData[] = [];

    for (const item of data) {
      // 통화 코드 추출 (예: "USD" from "미 달러")
      const currencyMatch = item.cur_unit?.match(/^([A-Z]{3})/);
      const currency = currencyMatch ? currencyMatch[1] : item.cur_unit;

      if (!SUPPORTED_CURRENCIES.includes(currency)) continue;

      // 매매기준율 파싱 (쉼표 제거)
      const rate = parseFloat(item.deal_bas_r?.replace(/,/g, "") || "0");

      // 100엔 단위 처리 (JPY)
      const normalizedRate = currency === "JPY" ? rate / 100 : rate;

      // 어제 대비 변동
      const yesterdayRate = yesterdayRates[currency] || normalizedRate;
      const change = normalizedRate - yesterdayRate;
      const changePercent = yesterdayRate > 0 ? (change / yesterdayRate) * 100 : 0;

      rates.push({
        currency,
        currencyName: "KRW",
        rate: normalizedRate,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        high: normalizedRate, // 수출입은행 API는 고가/저가 미제공
        low: normalizedRate,
        timestamp: new Date().toISOString(),
      });
    }

    return rates.length > 0 ? rates : null;
  } catch (error) {
    console.error("한국수출입은행 API 오류:", error);
    return null;
  }
}

/**
 * ExchangeRate-API에서 환율 조회 (무료 백업)
 * https://www.exchangerate-api.com/
 */
async function fetchFromExchangeRateAPI(): Promise<ExchangeRateData[] | null> {
  try {
    // 무료 API (API 키 불필요)
    const response = await fetch(
      "https://open.er-api.com/v6/latest/USD",
      { next: { revalidate: 300 } }
    );

    if (!response.ok) {
      throw new Error(`API 응답 오류: ${response.status}`);
    }

    const data = await response.json();

    if (data.result !== "success") {
      throw new Error("API 응답 실패");
    }

    const krwRate = data.rates.KRW;
    const yesterdayRates = await getYesterdayRates();

    const rates: ExchangeRateData[] = [];

    for (const currency of SUPPORTED_CURRENCIES) {
      let rate: number;

      if (currency === "USD") {
        rate = krwRate;
      } else {
        // 다른 통화는 USD 기준으로 계산
        const currencyToUsd = data.rates[currency];
        rate = krwRate / currencyToUsd;
      }

      const normalizedRate = Math.round(rate * 100) / 100;
      const yesterdayRate = yesterdayRates[currency] || normalizedRate;
      const change = normalizedRate - yesterdayRate;
      const changePercent = yesterdayRate > 0 ? (change / yesterdayRate) * 100 : 0;

      rates.push({
        currency,
        currencyName: "KRW",
        rate: normalizedRate,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        high: normalizedRate,
        low: normalizedRate,
        timestamp: new Date().toISOString(),
      });
    }

    return rates;
  } catch (error) {
    console.error("ExchangeRate-API 오류:", error);
    return null;
  }
}

/**
 * 어제 환율 조회 (DB에서)
 */
async function getYesterdayRates(): Promise<Record<string, number>> {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const rates = await prisma.exchangeRate.findMany({
      where: {
        timestamp: {
          gte: yesterday,
          lt: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { timestamp: "desc" },
      distinct: ["currency"],
    });

    const result: Record<string, number> = {};
    for (const rate of rates) {
      result[rate.currency] = Number(rate.rate);
    }
    return result;
  } catch {
    return {};
  }
}

/**
 * 환율 데이터를 DB에 저장
 */
async function saveRatesToDB(rates: ExchangeRateData[]): Promise<void> {
  try {
    const now = new Date();
    // 1시간에 한 번만 저장 (중복 방지)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const recentRate = await prisma.exchangeRate.findFirst({
      where: {
        timestamp: { gte: oneHourAgo },
      },
    });

    if (recentRate) {
      // 최근 1시간 내 저장된 데이터가 있으면 스킵
      return;
    }

    // 트랜잭션으로 일괄 저장
    await prisma.$transaction(
      rates.map((rate) =>
        prisma.exchangeRate.create({
          data: {
            currency: rate.currency,
            rate: rate.rate,
            change: rate.change,
            changePercent: rate.changePercent,
            high: rate.high,
            low: rate.low,
            timestamp: now,
          },
        })
      )
    );
  } catch (error) {
    console.error("환율 저장 오류:", error);
  }
}

/**
 * 환율 조회 (캐시 + API)
 */
export async function getExchangeRates(): Promise<ExchangeRateData[]> {
  // 캐시 확인
  if (rateCache && Date.now() - rateCache.timestamp < CACHE_DURATION) {
    return rateCache.data;
  }

  // 1차: 한국수출입은행 API
  let rates = await fetchFromKoreaExim();

  // 2차: ExchangeRate-API (백업)
  if (!rates) {
    rates = await fetchFromExchangeRateAPI();
  }

  // 3차: DB에서 최신 데이터
  if (!rates) {
    rates = await getLatestRatesFromDB();
  }

  // 4차: 기본값
  if (!rates || rates.length === 0) {
    rates = getDefaultRates();
  }

  // 캐시 업데이트
  rateCache = { data: rates, timestamp: Date.now() };

  // DB 저장 (비동기)
  saveRatesToDB(rates).catch(console.error);

  return rates;
}

/**
 * 특정 통화 환율 조회
 */
export async function getExchangeRate(currency: string): Promise<ExchangeRateData | null> {
  const rates = await getExchangeRates();
  return rates.find((r) => r.currency === currency) || null;
}

/**
 * DB에서 최신 환율 조회
 */
async function getLatestRatesFromDB(): Promise<ExchangeRateData[] | null> {
  try {
    const rates = await prisma.exchangeRate.findMany({
      orderBy: { timestamp: "desc" },
      distinct: ["currency"],
      take: 10,
    });

    if (rates.length === 0) return null;

    return rates.map((rate) => ({
      currency: rate.currency,
      currencyName: "KRW",
      rate: Number(rate.rate),
      change: Number(rate.change),
      changePercent: Number(rate.changePercent),
      high: Number(rate.high),
      low: Number(rate.low),
      timestamp: rate.timestamp.toISOString(),
    }));
  } catch {
    return null;
  }
}

/**
 * 기본 환율 (API 실패 시)
 */
function getDefaultRates(): ExchangeRateData[] {
  const timestamp = new Date().toISOString();
  return [
    { currency: "USD", currencyName: "KRW", rate: 1350, change: 0, changePercent: 0, high: 1350, low: 1350, timestamp },
    { currency: "EUR", currencyName: "KRW", rate: 1465, change: 0, changePercent: 0, high: 1465, low: 1465, timestamp },
    { currency: "JPY", currencyName: "KRW", rate: 9.0, change: 0, changePercent: 0, high: 9.0, low: 9.0, timestamp },
    { currency: "CNY", currencyName: "KRW", rate: 185, change: 0, changePercent: 0, high: 185, low: 185, timestamp },
    { currency: "GBP", currencyName: "KRW", rate: 1710, change: 0, changePercent: 0, high: 1710, low: 1710, timestamp },
  ];
}

/**
 * 환율 히스토리 조회
 */
export async function getExchangeRateHistory(
  currency: string,
  days: number = 30
): Promise<{ date: string; rate: number }[]> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const rates = await prisma.exchangeRate.findMany({
      where: {
        currency,
        timestamp: { gte: startDate },
      },
      orderBy: { timestamp: "asc" },
      select: {
        rate: true,
        timestamp: true,
      },
    });

    // 날짜별 그룹화 (하루에 여러 개면 마지막 것만)
    const dailyRates = new Map<string, number>();
    for (const rate of rates) {
      const dateKey = rate.timestamp.toISOString().split("T")[0];
      dailyRates.set(dateKey, Number(rate.rate));
    }

    return Array.from(dailyRates.entries()).map(([date, rate]) => ({
      date,
      rate,
    }));
  } catch {
    return [];
  }
}
