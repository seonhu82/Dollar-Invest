/**
 * 환율 API 서비스
 *
 * 데이터 소스:
 * 1. 한국수출입은행 Open API (primary) - 공식 환율
 * 2. ExchangeRate-API (fallback) - 무료 백업
 * 3. Frankfurter API (히스토리) - 무료, 키 불필요, 날짜 범위 지원
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

    const url = `https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey=${apiKey}&searchdate=${searchDate}&data=AP01`;

    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 300 }, // 5분 캐시
    });

    if (!response.ok) {
      console.error(`한국수출입은행 API HTTP ${response.status}: ${response.statusText}`);
      throw new Error(`API 응답 오류: ${response.status}`);
    }

    const data = await response.json();

    // API 에러 응답 처리 (result=2: 인증키 오류, result=4: 일일 제한 초과)
    if (!Array.isArray(data)) {
      console.error("한국수출입은행 API 비정상 응답:", JSON.stringify(data));
      return null;
    }

    if (data.length === 0) {
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
        high: normalizedRate, // 아래에서 7일 고가/저가로 업데이트
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
      { signal: AbortSignal.timeout(10000), next: { revalidate: 300 } }
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
 * Frankfurter API에서 현재 환율 조회 (무료, ECB 기반)
 * https://frankfurter.app/
 */
async function fetchFromFrankfurter(): Promise<ExchangeRateData[] | null> {
  try {
    const response = await fetch(
      "https://api.frankfurter.app/latest?from=KRW",
      { signal: AbortSignal.timeout(10000) }
    );

    if (!response.ok) {
      throw new Error(`Frankfurter API 응답 오류: ${response.status}`);
    }

    const data = await response.json();
    if (!data.rates) return null;

    const yesterdayRates = await getYesterdayRates();
    const rates: ExchangeRateData[] = [];

    for (const currency of SUPPORTED_CURRENCIES) {
      const foreignPerKrw = data.rates[currency];
      if (!foreignPerKrw) continue;

      // 1 외화 = X KRW (역수)
      const rate = Math.round((1 / foreignPerKrw) * 100) / 100;

      const yesterdayRate = yesterdayRates[currency] || rate;
      const change = rate - yesterdayRate;
      const changePercent = yesterdayRate > 0 ? (change / yesterdayRate) * 100 : 0;

      rates.push({
        currency,
        currencyName: "KRW",
        rate,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        high: rate,
        low: rate,
        timestamp: new Date().toISOString(),
      });
    }

    return rates.length > 0 ? rates : null;
  } catch (error) {
    console.error("Frankfurter API 오류:", error);
    return null;
  }
}

/**
 * 어제 환율 조회 (한국수출입은행 API에서 직접)
 */
async function getYesterdayRates(): Promise<Record<string, number>> {
  const apiKey = process.env.KOREA_EXIM_API_KEY;

  // API에서 어제 환율 가져오기 시도
  if (apiKey) {
    try {
      // 어제 날짜 (주말 건너뛰기)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      // 주말이면 금요일로
      const day = yesterday.getDay();
      if (day === 0) yesterday.setDate(yesterday.getDate() - 2); // 일요일 -> 금요일
      if (day === 6) yesterday.setDate(yesterday.getDate() - 1); // 토요일 -> 금요일

      const searchDate = yesterday.toISOString().split("T")[0].replace(/-/g, "");
      const url = `https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey=${apiKey}&searchdate=${searchDate}&data=AP01`;

      const response = await fetch(url, {
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const result: Record<string, number> = {};
          for (const item of data) {
            const currencyMatch = item.cur_unit?.match(/^([A-Z]{3})/);
            const currency = currencyMatch ? currencyMatch[1] : item.cur_unit;
            const rate = parseFloat(item.deal_bas_r?.replace(/,/g, "") || "0");
            const normalizedRate = currency === "JPY" ? rate / 100 : rate;
            if (SUPPORTED_CURRENCIES.includes(currency)) {
              result[currency] = normalizedRate;
            }
          }
          return result;
        }
      }
    } catch (error) {
      console.error("어제 환율 조회 오류:", error);
    }
  }

  // API 실패시 DB에서 조회
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

  // 1차: 한국수출입은행 API (공식 매매기준율)
  let rates = await fetchFromKoreaExim();

  // 2차: ExchangeRate-API (무료 백업)
  if (!rates) {
    console.log("환율 fallback: ExchangeRate-API 시도");
    rates = await fetchFromExchangeRateAPI();
  }

  // 3차: Frankfurter API (무료, ECB 기반)
  if (!rates) {
    console.log("환율 fallback: Frankfurter API 시도");
    rates = await fetchFromFrankfurter();
  }

  // 4차: DB에서 최신 데이터
  if (!rates) {
    console.log("환율 fallback: DB 캐시 조회");
    rates = await getLatestRatesFromDB();
  }

  // 5차: 기본값
  if (!rates || rates.length === 0) {
    console.log("환율 fallback: 기본값 사용");
    rates = getDefaultRates();
  }

  // 7일간 고가/저가 계산
  rates = await addHighLowFromHistory(rates);

  // 캐시 업데이트
  rateCache = { data: rates, timestamp: Date.now() };

  // DB 저장 (비동기)
  saveRatesToDB(rates).catch(console.error);

  return rates;
}

/**
 * 실시간 환율 조회 (캐시 무시, 거래용)
 * 거래 페이지에서 정확한 환율이 필요할 때 사용
 */
export async function getRealtimeRates(): Promise<ExchangeRateData[]> {
  // 캐시 무시하고 직접 API 호출
  let rates = await fetchFromKoreaExim();

  if (!rates) {
    rates = await fetchFromExchangeRateAPI();
  }

  if (!rates) {
    rates = await fetchFromFrankfurter();
  }

  if (!rates) {
    rates = await getLatestRatesFromDB();
  }

  if (!rates || rates.length === 0) {
    rates = getDefaultRates();
  }

  // 캐시도 업데이트 (다른 요청에 도움)
  rateCache = { data: rates, timestamp: Date.now() };

  return rates;
}

/**
 * 7일간 고가/저가 추가 (DB 캐시 기반 - API 호출 없음)
 */
async function addHighLowFromHistory(rates: ExchangeRateData[]): Promise<ExchangeRateData[]> {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dbRates = await prisma.exchangeRate.findMany({
      where: {
        timestamp: { gte: sevenDaysAgo },
      },
      select: {
        currency: true,
        rate: true,
      },
    });

    const highLowMap: Record<string, { high: number; low: number }> = {};

    for (const r of dbRates) {
      const rate = Number(r.rate);
      if (!highLowMap[r.currency]) {
        highLowMap[r.currency] = { high: rate, low: rate };
      } else {
        highLowMap[r.currency].high = Math.max(highLowMap[r.currency].high, rate);
        highLowMap[r.currency].low = Math.min(highLowMap[r.currency].low, rate);
      }
    }

    return rates.map((r) => ({
      ...r,
      high: highLowMap[r.currency]?.high || r.rate,
      low: highLowMap[r.currency]?.low || r.rate,
    }));
  } catch {
    return rates;
  }
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

// 히스토리 캐시 (기간별, 10분)
const historyCache = new Map<string, { data: { date: string; rate: number }[]; timestamp: number }>();
const HISTORY_CACHE_DURATION = 10 * 60 * 1000; // 10분

/**
 * Frankfurter API에서 환율 히스토리 조회 (단일 호출로 전체 기간)
 * https://frankfurter.app/
 * 무료, API 키 불필요, 날짜 범위 지원
 */
async function fetchHistoryFromFrankfurter(
  currency: string,
  days: number
): Promise<{ date: string; rate: number }[] | null> {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const startStr = startDate.toISOString().split("T")[0];
    const endStr = endDate.toISOString().split("T")[0];

    // Frankfurter는 KRW를 직접 지원
    // USD/KRW 조회: from=USD&to=KRW
    // EUR/KRW 조회: from=EUR&to=KRW
    const url = `https://api.frankfurter.app/${startStr}..${endStr}?from=${currency}&to=KRW`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(25000), // 1년 데이터 조회 시 충분한 시간
    });

    if (!response.ok) {
      console.error(`Frankfurter API 오류: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data.rates || typeof data.rates !== "object") {
      return null;
    }

    const results: { date: string; rate: number }[] = [];
    for (const [date, rates] of Object.entries(data.rates)) {
      const rateValue = (rates as Record<string, number>).KRW;
      if (rateValue) {
        // JPY는 Frankfurter가 1 JPY = X KRW로 제공하므로 변환 불필요
        results.push({ date, rate: Math.round(rateValue * 100) / 100 });
      }
    }

    return results.sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error("Frankfurter API 히스토리 오류:", error);
    return null;
  }
}

/**
 * ExchangeRate-API에서 히스토리 조회 (1건씩이지만 최근 며칠만 fallback)
 */
async function fetchHistoryFromExchangeRateAPI(
  currency: string,
  days: number
): Promise<{ date: string; rate: number }[] | null> {
  try {
    // 무료 API는 현재 환율만 제공하므로 현재값 1건 반환
    const response = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;

    const data = await response.json();
    if (data.result !== "success") return null;

    const krwRate = data.rates.KRW;
    let rate: number;

    if (currency === "USD") {
      rate = krwRate;
    } else {
      const currencyToUsd = data.rates[currency];
      rate = krwRate / currencyToUsd;
    }

    const today = new Date().toISOString().split("T")[0];
    return [{ date: today, rate: Math.round(rate * 100) / 100 }];
  } catch {
    return null;
  }
}

/**
 * 환율 히스토리 조회 (Frankfurter API + DB 보완)
 * 기존 한국수출입은행 per-day 호출 방식 대비 API 사용량 대폭 감소
 */
export async function getExchangeRateHistory(
  currency: string,
  days: number = 30
): Promise<{ date: string; rate: number }[]> {
  // 캐시 확인
  const cacheKey = `${currency}_${days}`;
  const cached = historyCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < HISTORY_CACHE_DURATION) {
    return cached.data;
  }

  const dailyRates = new Map<string, number>();

  // 1차: Frankfurter API (단일 호출로 전체 기간 조회)
  const frankfurterData = await fetchHistoryFromFrankfurter(currency, days);
  if (frankfurterData && frankfurterData.length > 0) {
    for (const item of frankfurterData) {
      dailyRates.set(item.date, item.rate);
    }
  }

  // 2차: DB에서 추가 데이터 보완
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const dbRates = await prisma.exchangeRate.findMany({
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

    for (const rate of dbRates) {
      const dateKey = rate.timestamp.toISOString().split("T")[0];
      if (!dailyRates.has(dateKey)) {
        dailyRates.set(dateKey, Number(rate.rate));
      }
    }
  } catch {
    // DB 오류 무시
  }

  // 3차: 데이터가 없으면 ExchangeRate-API fallback
  if (dailyRates.size === 0) {
    const fallbackData = await fetchHistoryFromExchangeRateAPI(currency, days);
    if (fallbackData) {
      for (const item of fallbackData) {
        dailyRates.set(item.date, item.rate);
      }
    }
  }

  const result = Array.from(dailyRates.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, rate]) => ({ date, rate }));

  // 캐시 저장
  historyCache.set(cacheKey, { data: result, timestamp: Date.now() });

  return result;
}
