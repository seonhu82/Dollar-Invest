/**
 * PC 브릿지 통신 서비스
 *
 * 하나증권 1Q Open API와 통신하는 Windows 브릿지 프로그램과 연동
 * 브릿지 URL: http://127.0.0.1:8585
 */

const BRIDGE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL || "http://127.0.0.1:8585";
const TIMEOUT = 10000; // 10초

export interface BridgeStatus {
  connected: boolean;
  hanaConnected: boolean;
  version: string | null;
}

export interface HanaBalance {
  currency: string;
  balance: number;
  availableBalance: number;
  avgBuyRate: number;
  profitLoss: number;
  profitLossPercent: number;
}

export interface HanaOrder {
  orderId: string;
  type: "BUY" | "SELL";
  currency: string;
  amount: number;
  rate: number;
  status: "PENDING" | "COMPLETED" | "CANCELLED" | "FAILED";
  orderedAt: string;
}

/**
 * 브릿지 상태 확인
 */
export async function getBridgeStatus(): Promise<BridgeStatus> {
  try {
    const response = await fetch(`${BRIDGE_URL}/api/status`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      connected: data.connected ?? false,
      hanaConnected: data.hanaConnected ?? false,
      version: data.version ?? null,
    };
  } catch {
    return {
      connected: false,
      hanaConnected: false,
      version: null,
    };
  }
}

/**
 * 하나증권 API 연결
 */
export async function hanaConnect(): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${BRIDGE_URL}/api/hana/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(TIMEOUT),
    });

    const data = await response.json();
    return {
      success: data.success ?? response.ok,
      message: data.message || data.error || "연결 완료",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "연결 실패",
    };
  }
}

/**
 * 하나증권 로그인 (인증서)
 */
export async function hanaLogin(): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${BRIDGE_URL}/api/hana/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(60000), // 로그인은 60초 대기
    });

    const data = await response.json();
    return {
      success: data.success ?? response.ok,
      message: data.message || data.error || "로그인 완료",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "로그인 실패",
    };
  }
}

/**
 * 하나증권 로그아웃
 */
export async function hanaDisconnect(): Promise<{ success: boolean }> {
  try {
    const response = await fetch(`${BRIDGE_URL}/api/hana/logout`, {
      method: "POST",
      signal: AbortSignal.timeout(5000),
    });

    const data = await response.json();
    return { success: data.success ?? response.ok };
  } catch {
    return { success: false };
  }
}

/**
 * 외화 잔고 조회
 */
export async function getHanaBalance(accountNo?: string): Promise<{
  success: boolean;
  balance?: HanaBalance;
  balances?: HanaBalance[];
  error?: string;
}> {
  try {
    const response = await fetch(`${BRIDGE_URL}/api/hana/balance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountNo: accountNo || "" }),
      signal: AbortSignal.timeout(TIMEOUT),
    });

    const data = await response.json();

    if (!data.success) {
      return { success: false, error: data.error || "잔고 조회 실패" };
    }

    return {
      success: true,
      balance: data.balance,
      balances: data.balances || (data.balance ? [data.balance] : []),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "잔고 조회 실패",
    };
  }
}

/**
 * 외화 매수 주문
 */
export async function hanaBuyOrder(params: {
  accountNo: string;
  amount: number;
  rate?: number; // 지정가 (없으면 시장가)
  password?: string;
}): Promise<{
  success: boolean;
  orderId?: string;
  message?: string;
}> {
  try {
    const response = await fetch(`${BRIDGE_URL}/api/hana/order/buy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountNo: params.accountNo,
        amount: params.amount,
        rate: params.rate || 0,
        password: params.password || "",
      }),
      signal: AbortSignal.timeout(TIMEOUT),
    });

    const data = await response.json();

    if (!data.success) {
      return { success: false, message: data.error || "매수 실패" };
    }

    return { success: true, orderId: data.orderId, message: data.message };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "매수 주문 실패",
    };
  }
}

/**
 * 외화 매도 주문
 */
export async function hanaSellOrder(params: {
  accountNo: string;
  amount: number;
  rate?: number;
  password?: string;
}): Promise<{
  success: boolean;
  orderId?: string;
  message?: string;
}> {
  try {
    const response = await fetch(`${BRIDGE_URL}/api/hana/order/sell`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountNo: params.accountNo,
        amount: params.amount,
        rate: params.rate || 0,
        password: params.password || "",
      }),
      signal: AbortSignal.timeout(TIMEOUT),
    });

    const data = await response.json();

    if (!data.success) {
      return { success: false, message: data.error || "매도 실패" };
    }

    return { success: true, orderId: data.orderId, message: data.message };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "매도 주문 실패",
    };
  }
}

/**
 * 주문 내역 조회
 */
export async function getHanaOrders(params: {
  accountNo: string;
  startDate?: string;
  endDate?: string;
}): Promise<{
  success: boolean;
  orders?: HanaOrder[];
  error?: string;
}> {
  try {
    const response = await fetch(`${BRIDGE_URL}/api/hana/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountNo: params.accountNo,
        startDate: params.startDate || "",
        endDate: params.endDate || "",
      }),
      signal: AbortSignal.timeout(TIMEOUT),
    });

    const data = await response.json();

    if (!data.success) {
      return { success: false, error: data.error || "조회 실패" };
    }

    return { success: true, orders: data.orders };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "주문 내역 조회 실패",
    };
  }
}

/**
 * 거래 내역 동기화 (웹 앱 -> DB 저장용)
 */
export async function syncHanaTransactions(params?: {
  accountNo?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{
  success: boolean;
  transactions?: Array<{
    orderId: string;
    type: "BUY" | "SELL";
    currency: string;
    amount: number;
    rate: number;
    krwAmount: number;
    fee: number;
    tradedAt: string;
    orderedAt: string;
  }>;
  error?: string;
}> {
  const result = await getHanaOrders({
    accountNo: params?.accountNo || "",
    startDate: params?.startDate,
    endDate: params?.endDate,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    transactions: result.orders?.map((order) => ({
      orderId: order.orderId,
      type: order.type,
      currency: order.currency,
      amount: order.amount,
      rate: order.rate,
      krwAmount: order.amount * order.rate,
      fee: 0,
      tradedAt: order.orderedAt,
      orderedAt: order.orderedAt,
    })),
  };
}
