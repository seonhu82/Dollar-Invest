/**
 * 환율 API 서비스
 *
 * 데이터 소스:
 * 1. Twelve Data API (primary) - 실시간 외환시장 환율
 * 2. 한국수출입은행 Open API (fallback) - 공식 매매기준율 (하루 1회 공시)
 * 3. ExchangeRate-API (fallback) - 무료 백업
 * 4. Frankfurter API (히스토리) - 무료, 키 불필요, 날짜 범위 지원
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

// 메모리 캐시 (1분 - 실시간 환율 반영)
let rateCache: { data: ExchangeRateData[]; timestamp: number } | null = null;
const CACHE_DURATION = 1 * 60 * 1000; // 1분

// 지원 통화
const SUPPORTED_CURRENCIES = ["USD", "EUR", "JPY", "CNY", "GBP"];

/**
 * Twelve Data API에서 실시간 외환시장 환율 조회
 * https://twelvedata.com/docs#exchange-rate
 * 무료: 800 API 크레딧/일, 8 크레딧/분
 */
async function fetchFromTwelveData(): Promise<ExchangeRateData[] | null> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    console.log("Twelve Data API 키가 설정되지 않았습니다.");
    return null;
  }

  try {
    // 모든 통화쌍을 한 번에 조회
    const symbols = SUPPORTED_CURRENCIES.map((c) => `${c}/KRW`).join(",");
    const url = `https://api.twelvedata.com/exchange_rate?symbol=${symbols}&apikey=${apiKey}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`Twelve Data API HTTP ${response.status}: ${response.statusText}`);
      return null;
    }

    const data = await response.json();

    // 에러 응답 처리
    if (data.code && data.status === "error") {
      console.error("Twelve Data API 오류:", data.message);
      return null;
    }

    const yesterdayRates = await getYesterdayRates();
    const rates: ExchangeRateData[] = [];

    // 단일 심볼이면 객체, 다중 심볼이면 키별 객체
    const entries = SUPPORTED_CURRENCIES.length === 1
      ? [[`${SUPPORTED_CURRENCIES[0]}/KRW`, data]]
      : Object.entries(data);

    for (const [symbol, info] of entries) {
      const symbolData = info as { symbol?: string; rate?: number; timestamp?: number; code?: number };

      // 개별 심볼 에러 스킵
      if (symbolData.code && symbolData.code !== 200) continue;

      const currency = (symbol as string).split("/")[0];
      if (!SUPPORTED_CURRENCIES.includes(currency)) continue;

      const rate = typeof symbolData.rate === "string"
        ? parseFloat(symbolData.rate)
        : symbolData.rate;

      if (!rate || isNaN(rate)) continue;

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

    if (rates.length > 0) {
      console.log(`Twelve Data: 실시간 환율 ${rates.length}개 통화 조회 성공`);
    }

    return rates.length > 0 ? rates : null;
  } catch (error) {
    console.error("Twelve Data API 오류:", error);
    return null;
  }
}

/**
 * 한국수출입은행 API에서 환율 조회 (하루 1회 공시 매매기준율)
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
      cache: "no-store",
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
      { signal: AbortSignal.timeout(10000), cache: "no-store" }
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
 * 누락 통화를 ExchangeRate-API로 빠르게 보완 (API 키 불필요)
 */
async function supplementMissingRates(rates: ExchangeRateData[], missingCurrencies: string[]): Promise<void> {
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return;

    const data = await response.json();
    if (data.result !== "success") return;

    const krwRate = data.rates?.KRW;
    if (!krwRate) return;

    for (const currency of missingCurrencies) {
      let rate: number;
      if (currency === "USD") {
        rate = krwRate;
      } else {
        const currencyToUsd = data.rates?.[currency];
        if (!currencyToUsd) continue;
        rate = krwRate / currencyToUsd;
      }

      const normalizedRate = Math.round(rate * 100) / 100;
      rates.push({
        currency,
        currencyName: "KRW",
        rate: normalizedRate,
        change: 0,
        changePercent: 0,
        high: normalizedRate,
        low: normalizedRate,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("누락 통화 보완 오류:", error);
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

  // 1차: Twelve Data API (실시간 외환시장 환율)
  let rates = await fetchFromTwelveData();

  // Twelve Data에서 일부 통화 누락 시 ExchangeRate-API로 빠르게 보완
  if (rates) {
    const missingCurrencies = SUPPORTED_CURRENCIES.filter((c) => !rates!.find((r) => r.currency === c));
    if (missingCurrencies.length > 0) {
      console.log(`Twelve Data 누락 통화 보완: ${missingCurrencies.join(", ")}`);
      await supplementMissingRates(rates, missingCurrencies);
    }
  }

  // 2차: 한국수출입은행 API (공식 매매기준율, 하루 1회)
  if (!rates) {
    console.log("환율 fallback: 한국수출입은행 시도");
    rates = await fetchFromKoreaExim();
  }

  // 3차: ExchangeRate-API (무료 백업)
  if (!rates) {
    console.log("환율 fallback: ExchangeRate-API 시도");
    rates = await fetchFromExchangeRateAPI();
  }

  // 4차: Frankfurter API (무료, ECB 기반)
  if (!rates) {
    console.log("환율 fallback: Frankfurter API 시도");
    rates = await fetchFromFrankfurter();
  }

  // 5차: DB에서 최신 데이터
  if (!rates) {
    console.log("환율 fallback: DB 캐시 조회");
    rates = await getLatestRatesFromDB();
  }

  // 6차: 기본값
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
  // 캐시 무시하고 직접 API 호출 (실시간 우선)
  let rates = await fetchFromTwelveData();

  // 누락 통화 보완
  if (rates) {
    const missingCurrencies = SUPPORTED_CURRENCIES.filter((c) => !rates!.find((r) => r.currency === c));
    if (missingCurrencies.length > 0) {
      await supplementMissingRates(rates, missingCurrencies);
    }
  }

  if (!rates) {
    rates = await fetchFromKoreaExim();
  }

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

  // 7일간 고가/저가 추가
  rates = await addHighLowFromHistory(rates);

  // 캐시도 업데이트 (다른 요청에 도움)
  rateCache = { data: rates, timestamp: Date.now() };

  // DB 저장 (비동기)
  saveRatesToDB(rates).catch(console.error);

  return rates;
}

/**
 * 7일간 고가/저가 추가 (DB + Frankfurter API 폴백)
 */
async function addHighLowFromHistory(rates: ExchangeRateData[]): Promise<ExchangeRateData[]> {
  try {
    const highLowMap: Record<string, { high: number; low: number }> = {};

    // 1차: DB에서 7일간 데이터 조회
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

    for (const r of dbRates) {
      const rate = Number(r.rate);
      if (!highLowMap[r.currency]) {
        highLowMap[r.currency] = { high: rate, low: rate };
      } else {
        highLowMap[r.currency].high = Math.max(highLowMap[r.currency].high, rate);
        highLowMap[r.currency].low = Math.min(highLowMap[r.currency].low, rate);
      }
    }

    // 2차: DB에 데이터 없는 통화는 Frankfurter API로 보완
    const missingCurrencies = rates
      .map((r) => r.currency)
      .filter((c) => !highLowMap[c] || (highLowMap[c].high === highLowMap[c].low));

    if (missingCurrencies.length > 0) {
      for (const currency of missingCurrencies) {
        try {
          const history = await fetchHistoryFromFrankfurter(currency, 7);
          if (history && history.length > 1) {
            const histRates = history.map((h) => h.rate);
            highLowMap[currency] = {
              high: Math.max(...histRates),
              low: Math.min(...histRates),
            };
          }
        } catch {
          // 개별 통화 실패 무시
        }
      }
    }

    return rates.map((r) => ({
      ...r,
      high: highLowMap[r.currency]?.high ?? r.rate,
      low: highLowMap[r.currency]?.low ?? r.rate,
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

// 히스토리 캐시 (통화별 전체 데이터, 30분)
const historyFullCache = new Map<string, { data: { date: string; rate: number }[]; timestamp: number; maxDays: number }>();
const HISTORY_CACHE_DURATION = 30 * 60 * 1000; // 30분

/**
 * Twelve Data time_series API에서 일봉 히스토리 조회
 * https://twelvedata.com/docs#time-series
 * 외환시장 실거래 데이터 (TradingView와 동일 소스)
 * 무료: 800 API 크레딧/일, 8 크레딧/분, 1 호출 = 1 크레딧
 */
async function fetchHistoryFromTwelveData(
  currency: string,
  days: number
): Promise<{ date: string; rate: number }[] | null> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    console.log("Twelve Data API 키가 설정되지 않았습니다 (히스토리).");
    return null;
  }

  try {
    const symbol = `${currency}/KRW`;
    const outputsize = Math.min(days + 15, 500); // 공휴일 감안 여유분

    const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=${outputsize}&apikey=${apiKey}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`Twelve Data time_series HTTP ${response.status} (${currency})`);
      return null;
    }

    const data = await response.json();

    // 에러 응답 처리
    if (data.code && data.status === "error") {
      console.error(`Twelve Data time_series 오류 (${currency}):`, data.message);
      return null;
    }

    if (!data.values || !Array.isArray(data.values) || data.values.length === 0) {
      return null;
    }

    const results: { date: string; rate: number }[] = [];

    for (const item of data.values) {
      const rate = parseFloat(item.close);
      if (!rate || isNaN(rate)) continue;
      results.push({
        date: item.datetime.split(" ")[0], // "2026-02-27" 형식 통일
        rate: Math.round(rate * 100) / 100,
      });
    }

    // Twelve Data는 최신→과거 순이므로 오름차순 정렬
    results.sort((a, b) => a.date.localeCompare(b.date));

    if (results.length > 0) {
      console.log(`Twelve Data time_series: ${currency} ${results.length}일 히스토리 조회 성공`);
    }

    return results;
  } catch (error) {
    console.error(`Twelve Data time_series 오류 (${currency}):`, error);
    return null;
  }
}

/**
 * Frankfurter API에서 환율 히스토리 조회 (ECB 참고환율, fallback용)
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

    const url = `https://api.frankfurter.app/${startStr}..${endStr}?from=${currency}&to=KRW`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(25000),
      cache: "no-store",
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
 * 환율 히스토리 조회 (Twelve Data → Frankfurter → DB → ExchangeRate-API)
 *
 * 1차: Twelve Data time_series - 외환시장 일봉 데이터 (TradingView와 일치)
 * 2차: Frankfurter API - ECB 참고환율 (Twelve Data 실패 시)
 * 3차: DB 보완
 * 4차: ExchangeRate-API (최후 수단)
 *
 * 통화별 전체 데이터를 30분간 캐시하고, 요청 기간에 맞게 잘라서 반환
 */
export async function getExchangeRateHistory(
  currency: string,
  days: number = 30
): Promise<{ date: string; rate: number }[]> {
  // 캐시 확인: 이미 같은 통화의 캐시가 있고, 요청 기간보다 많으면 슬라이스
  const cached = historyFullCache.get(currency);
  if (cached && Date.now() - cached.timestamp < HISTORY_CACHE_DURATION && cached.maxDays >= days) {
    return sliceHistoryByDays(cached.data, days);
  }

  // 요청 기간이 캐시보다 크면 새로 fetch
  const fetchDays = Math.max(days, 120); // MA50 등 기술분석 위해 최소 120일
  const dailyRates = new Map<string, number>();

  // 1차: Twelve Data time_series (외환시장 실거래 데이터)
  const twelveData = await fetchHistoryFromTwelveData(currency, fetchDays);
  if (twelveData && twelveData.length > 0) {
    for (const item of twelveData) {
      dailyRates.set(item.date, item.rate);
    }
  }

  // 2차: Frankfurter API (Twelve Data 실패 또는 부족 시 보완)
  if (dailyRates.size < 20) {
    const frankfurterData = await fetchHistoryFromFrankfurter(currency, fetchDays);
    if (frankfurterData && frankfurterData.length > 0) {
      for (const item of frankfurterData) {
        if (!dailyRates.has(item.date)) {
          dailyRates.set(item.date, item.rate);
        }
      }
    }
  }

  // 3차: DB에서 추가 데이터 보완
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - fetchDays);

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

  // 4차: 데이터가 없으면 ExchangeRate-API fallback
  if (dailyRates.size === 0) {
    const fallbackData = await fetchHistoryFromExchangeRateAPI(currency, fetchDays);
    if (fallbackData) {
      for (const item of fallbackData) {
        dailyRates.set(item.date, item.rate);
      }
    }
  }

  const fullResult = Array.from(dailyRates.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, rate]) => ({ date, rate }));

  // 전체 캐시 저장 (통화당 1개)
  historyFullCache.set(currency, { data: fullResult, timestamp: Date.now(), maxDays: fetchDays });

  return sliceHistoryByDays(fullResult, days);
}

/** 히스토리 데이터를 요청 일수에 맞게 최근 N일만 반환 */
function sliceHistoryByDays(data: { date: string; rate: number }[], days: number): { date: string; rate: number }[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days - 1);
  const cutoff = cutoffDate.toISOString().split("T")[0];
  return data.filter((d) => d.date >= cutoff);
}
