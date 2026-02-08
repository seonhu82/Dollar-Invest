/**
 * 한국투자증권 KIS Developers REST API 클라이언트
 * https://apiportal.koreainvestment.com
 */

import { prisma } from "./prisma";

const KIS_BASE_URL = process.env.KIS_BASE_URL || "https://openapi.koreainvestment.com:9443";

// 토큰 캐시 (메모리)
const tokenCache: Map<string, { token: string; expiresAt: Date }> = new Map();

export interface KISCredentials {
  appKey: string;
  appSecret: string;
  accountNo: string;
  accountProductCode?: string; // 계좌상품코드 (기본: 01)
}

export interface KISBalance {
  currency: string;
  balance: number;
  availableBalance: number;
  totalValue: number;
  profitLoss: number;
  profitLossPercent: number;
}

export interface KISOrder {
  orderId: string;
  type: "BUY" | "SELL";
  currency: string;
  amount: number;
  rate: number;
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  orderedAt: string;
  completedAt?: string;
}

/**
 * 접근 토큰 발급
 */
async function getAccessToken(credentials: KISCredentials): Promise<string> {
  const cacheKey = `${credentials.appKey}:${credentials.accountNo}`;
  const cached = tokenCache.get(cacheKey);

  // 캐시된 토큰이 유효하면 사용
  if (cached && cached.expiresAt > new Date()) {
    return cached.token;
  }

  try {
    const response = await fetch(`${KIS_BASE_URL}/oauth2/tokenP`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        grant_type: "client_credentials",
        appkey: credentials.appKey,
        appsecret: credentials.appSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.msg1 || `토큰 발급 실패: ${response.status}`);
    }

    const data = await response.json();

    if (!data.access_token) {
      throw new Error("토큰이 응답에 없습니다.");
    }

    // 토큰 캐시 (만료 시간 - 5분 여유)
    const expiresIn = data.expires_in || 86400; // 기본 24시간
    const expiresAt = new Date(Date.now() + (expiresIn - 300) * 1000);

    tokenCache.set(cacheKey, {
      token: data.access_token,
      expiresAt,
    });

    return data.access_token;
  } catch (error) {
    console.error("KIS 토큰 발급 오류:", error);
    throw error;
  }
}

/**
 * API 요청 헬퍼
 */
async function kisRequest(
  credentials: KISCredentials,
  endpoint: string,
  options: {
    method?: "GET" | "POST";
    trId: string;
    params?: Record<string, string>;
    body?: Record<string, unknown>;
  }
): Promise<unknown> {
  const token = await getAccessToken(credentials);

  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=UTF-8",
    authorization: `Bearer ${token}`,
    appkey: credentials.appKey,
    appsecret: credentials.appSecret,
    tr_id: options.trId,
  };

  let url = `${KIS_BASE_URL}${endpoint}`;

  if (options.params) {
    const searchParams = new URLSearchParams(options.params);
    url += `?${searchParams.toString()}`;
  }

  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json();

  if (data.rt_cd !== "0") {
    throw new Error(data.msg1 || `API 오류: ${data.rt_cd}`);
  }

  return data;
}

/**
 * 자격 증명 검증 (연결 테스트)
 */
export async function verifyCredentials(credentials: KISCredentials): Promise<boolean> {
  try {
    await getAccessToken(credentials);
    return true;
  } catch {
    return false;
  }
}

/**
 * 외화 잔고 조회
 * TR-ID: TTTC6524R (실전) / VTTC6524R (모의)
 */
export async function getKISBalance(credentials: KISCredentials): Promise<KISBalance | null> {
  try {
    const productCode = credentials.accountProductCode || "01";

    const data = await kisRequest(credentials, "/uapi/overseas-stock/v1/trading/inquire-present-balance", {
      trId: "CTRP6504R", // 해외주식 현재잔고
      params: {
        CANO: credentials.accountNo.substring(0, 8), // 계좌번호 앞 8자리
        ACNT_PRDT_CD: productCode, // 계좌상품코드
        WCRC_FRCR_DVSN_CD: "01", // 원화외화구분 (01: 외화)
        NATN_CD: "840", // 국가코드 (840: 미국)
        TR_MKET_CD: "00", // 거래시장코드
        INQR_DVSN_CD: "00", // 조회구분
      },
    }) as {
      output2?: Array<{
        frcr_evlu_amt2?: string;
        frcr_dncl_amt_2?: string;
        frcr_pchs_amt1?: string;
        ovrs_rlzt_pfls_amt?: string;
      }>;
    };

    // 응답 파싱 (실제 응답 구조에 맞게 조정 필요)
    const output = data.output2?.[0];
    if (!output) {
      return {
        currency: "USD",
        balance: 0,
        availableBalance: 0,
        totalValue: 0,
        profitLoss: 0,
        profitLossPercent: 0,
      };
    }

    const totalValue = parseFloat(output.frcr_evlu_amt2 || "0");
    const availableBalance = parseFloat(output.frcr_dncl_amt_2 || "0");
    const purchaseAmount = parseFloat(output.frcr_pchs_amt1 || "0");
    const profitLoss = parseFloat(output.ovrs_rlzt_pfls_amt || "0");

    return {
      currency: "USD",
      balance: totalValue,
      availableBalance,
      totalValue,
      profitLoss,
      profitLossPercent: purchaseAmount > 0 ? (profitLoss / purchaseAmount) * 100 : 0,
    };
  } catch (error) {
    console.error("KIS 잔고 조회 오류:", error);
    return null;
  }
}

/**
 * 외화 매수 주문
 * TR-ID: TTTT1002U (실전) / VTTT1002U (모의)
 */
export async function placeKISBuyOrder(
  credentials: KISCredentials,
  amount: number, // USD 금액
  memo?: string
): Promise<{ orderId: string; message: string } | null> {
  try {
    const productCode = credentials.accountProductCode || "01";

    const data = await kisRequest(credentials, "/uapi/overseas-stock/v1/trading/order", {
      method: "POST",
      trId: "TTTT1002U", // 해외주식 매수주문
      body: {
        CANO: credentials.accountNo.substring(0, 8),
        ACNT_PRDT_CD: productCode,
        OVRS_EXCG_CD: "NASD", // 거래소 (NASD: 나스닥)
        PDNO: "USD", // 종목코드 (외화의 경우)
        ORD_QTY: String(amount),
        OVRS_ORD_UNPR: "0", // 주문단가 (시장가: 0)
        ORD_DVSN: "00", // 주문구분 (00: 시장가)
        ORD_SVR_DVSN_CD: "0",
      },
    }) as {
      output?: {
        ODNO?: string;
      };
      msg1?: string;
    };

    return {
      orderId: data.output?.ODNO || "",
      message: data.msg1 || "주문이 접수되었습니다.",
    };
  } catch (error) {
    console.error("KIS 매수 주문 오류:", error);
    return null;
  }
}

/**
 * 외화 매도 주문
 * TR-ID: TTTT1006U (실전) / VTTT1006U (모의)
 */
export async function placeKISSellOrder(
  credentials: KISCredentials,
  amount: number,
  memo?: string
): Promise<{ orderId: string; message: string } | null> {
  try {
    const productCode = credentials.accountProductCode || "01";

    const data = await kisRequest(credentials, "/uapi/overseas-stock/v1/trading/order", {
      method: "POST",
      trId: "TTTT1006U", // 해외주식 매도주문
      body: {
        CANO: credentials.accountNo.substring(0, 8),
        ACNT_PRDT_CD: productCode,
        OVRS_EXCG_CD: "NASD",
        PDNO: "USD",
        ORD_QTY: String(amount),
        OVRS_ORD_UNPR: "0",
        ORD_DVSN: "00",
        ORD_SVR_DVSN_CD: "0",
      },
    }) as {
      output?: {
        ODNO?: string;
      };
      msg1?: string;
    };

    return {
      orderId: data.output?.ODNO || "",
      message: data.msg1 || "주문이 접수되었습니다.",
    };
  } catch (error) {
    console.error("KIS 매도 주문 오류:", error);
    return null;
  }
}

/**
 * 거래 내역 조회
 * TR-ID: TTTC8001R (실전) / VTTC8001R (모의)
 */
export async function getKISTransactions(
  credentials: KISCredentials,
  startDate: string, // YYYYMMDD
  endDate: string
): Promise<KISOrder[]> {
  try {
    const productCode = credentials.accountProductCode || "01";

    const data = await kisRequest(credentials, "/uapi/overseas-stock/v1/trading/inquire-ccnl", {
      trId: "TTTC8001R", // 해외주식 체결내역
      params: {
        CANO: credentials.accountNo.substring(0, 8),
        ACNT_PRDT_CD: productCode,
        PDNO: "", // 전체 종목
        ORD_STRT_DT: startDate,
        ORD_END_DT: endDate,
        SLL_BUY_DVSN: "00", // 전체
        CCLD_NCCS_DVSN: "00", // 전체
        OVRS_EXCG_CD: "NASD",
        SORT_SQN: "DS", // 정렬순서 (DS: 내림차순)
        ORD_DT: "",
        ORD_GNO_BRNO: "",
        ODNO: "",
      },
    }) as {
      output?: Array<{
        ODNO?: string;
        SLL_BUY_DVSN_CD?: string;
        FT_CCLD_QTY?: string;
        FT_CCLD_UNPR3?: string;
        ORD_TMD?: string;
        CCLD_DT?: string;
        CCLD_CNDT_NAME?: string;
      }>;
    };

    if (!data.output || !Array.isArray(data.output)) {
      return [];
    }

    return data.output
      .filter((item) => item.ODNO)
      .map((item) => ({
        orderId: item.ODNO || "",
        type: item.SLL_BUY_DVSN_CD === "01" ? "SELL" : "BUY",
        currency: "USD",
        amount: parseFloat(item.FT_CCLD_QTY || "0"),
        rate: parseFloat(item.FT_CCLD_UNPR3 || "0"),
        status: "COMPLETED" as const,
        orderedAt: item.ORD_TMD || "",
        completedAt: item.CCLD_DT || undefined,
      }));
  } catch (error) {
    console.error("KIS 거래내역 조회 오류:", error);
    return [];
  }
}

/**
 * 자격 증명 저장
 */
export async function saveKISCredentials(
  userId: string,
  credentials: KISCredentials,
  alias?: string
): Promise<string> {
  // 기존 연동 확인
  const existing = await prisma.brokerAccount.findFirst({
    where: {
      userId,
      broker: "KIS",
      kisAccountNo: credentials.accountNo,
    },
  });

  if (existing) {
    throw new Error("이미 연동된 계좌입니다.");
  }

  const account = await prisma.brokerAccount.create({
    data: {
      userId,
      broker: "KIS",
      kisAppKey: credentials.appKey,
      kisAppSecret: credentials.appSecret,
      kisAccountNo: credentials.accountNo,
      accountAlias: alias || `KIS-${credentials.accountNo.slice(-4)}`,
    },
  });

  return account.id;
}

/**
 * 저장된 자격 증명 로드
 */
export async function loadKISCredentials(
  brokerAccountId: string
): Promise<KISCredentials | null> {
  const account = await prisma.brokerAccount.findUnique({
    where: { id: brokerAccountId },
  });

  if (!account || account.broker !== "KIS") {
    return null;
  }

  if (!account.kisAppKey || !account.kisAppSecret || !account.kisAccountNo) {
    return null;
  }

  return {
    appKey: account.kisAppKey,
    appSecret: account.kisAppSecret,
    accountNo: account.kisAccountNo,
    accountProductCode: "01",
  };
}

/**
 * 거래내역 동기화
 */
export async function syncKISTransactions(
  userId: string,
  brokerAccountId: string
): Promise<{ synced: number; message: string }> {
  const credentials = await loadKISCredentials(brokerAccountId);

  if (!credentials) {
    throw new Error("자격 증명을 찾을 수 없습니다.");
  }

  // 최근 30일 거래내역 조회
  const endDate = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0]
    .replace(/-/g, "");

  const transactions = await getKISTransactions(credentials, startDate, endDate);

  if (transactions.length === 0) {
    // 동기화 시간 업데이트
    await prisma.brokerAccount.update({
      where: { id: brokerAccountId },
      data: { lastSyncAt: new Date() },
    });

    return { synced: 0, message: "동기화할 거래내역이 없습니다." };
  }

  // 기본 포트폴리오 찾기 또는 생성
  let portfolio = await prisma.portfolio.findFirst({
    where: {
      userId,
      brokerAccountId,
    },
  });

  if (!portfolio) {
    const account = await prisma.brokerAccount.findUnique({
      where: { id: brokerAccountId },
    });

    portfolio = await prisma.portfolio.create({
      data: {
        userId,
        name: `KIS-${account?.accountAlias || credentials.accountNo.slice(-4)}`,
        currency: "USD",
        brokerAccountId,
      },
    });
  }

  // 거래내역 저장 (중복 방지)
  let syncedCount = 0;

  for (const tx of transactions) {
    const existing = await prisma.transaction.findFirst({
      where: {
        portfolioId: portfolio.id,
        brokerOrderId: tx.orderId,
      },
    });

    if (!existing) {
      const krwAmount = tx.amount * tx.rate;
      await prisma.transaction.create({
        data: {
          userId,
          portfolioId: portfolio.id,
          type: tx.type,
          amount: tx.amount,
          rate: tx.rate,
          krwAmount,
          fee: 0,
          memo: `KIS 자동 동기화 (주문번호: ${tx.orderId})`,
          tradedAt: tx.completedAt ? new Date(tx.completedAt) : new Date(tx.orderedAt),
          orderId: tx.orderId,
          isManual: false,
          syncedAt: new Date(),
        },
      });
      syncedCount++;

      // 포트폴리오 잔고 업데이트
      if (tx.type === "BUY") {
        const currentBalance = Number(portfolio.currentBalance);
        const currentAvgRate = Number(portfolio.avgBuyRate) || tx.rate;
        const newBalance = currentBalance + tx.amount;
        const newAvgRate =
          (currentBalance * currentAvgRate + tx.amount * tx.rate) / newBalance;

        await prisma.portfolio.update({
          where: { id: portfolio.id },
          data: {
            currentBalance: newBalance,
            avgBuyRate: newAvgRate,
          },
        });

        portfolio = await prisma.portfolio.findUnique({
          where: { id: portfolio.id },
        }) as typeof portfolio;
      } else {
        const newBalance = Math.max(0, Number(portfolio.currentBalance) - tx.amount);

        await prisma.portfolio.update({
          where: { id: portfolio.id },
          data: { currentBalance: newBalance },
        });

        portfolio = await prisma.portfolio.findUnique({
          where: { id: portfolio.id },
        }) as typeof portfolio;
      }
    }
  }

  // 동기화 시간 업데이트
  await prisma.brokerAccount.update({
    where: { id: brokerAccountId },
    data: { lastSyncAt: new Date() },
  });

  return {
    synced: syncedCount,
    message: `${syncedCount}건의 거래내역을 동기화했습니다.`,
  };
}
