// 증권사 타입
export type BrokerType = "HANA" | "KIS" | "MANUAL";

// 거래 타입
export type TransactionType = "BUY" | "SELL";

// 통화 타입
export type CurrencyType = "USD" | "EUR" | "JPY" | "CNY";

// 알림 타입
export type AlertType = "TARGET_RATE" | "CHANGE_RATE" | "DAILY";

// 알림 방향
export type AlertDirection = "ABOVE" | "BELOW";

// 주문 상태
export type OrderStatus = "PENDING" | "FILLED" | "CANCELLED";

// 분할 계획 상태
export type SplitPlanStatus = "ACTIVE" | "PAUSED" | "COMPLETED";

// 환율 데이터
export interface ExchangeRateData {
  currency: string;
  rate: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  timestamp: Date;
}

// 포트폴리오 요약
export interface PortfolioSummary {
  id: string;
  name: string;
  currency: CurrencyType;
  currentBalance: number;
  avgBuyRate: number;
  totalInvested: number;
  currentValue: number;
  profitLoss: number;
  profitLossPercent: number;
  broker: BrokerType;
}

// 거래 내역
export interface TransactionData {
  id: string;
  type: TransactionType;
  currency: string;
  amount: number;
  rate: number;
  krwAmount: number;
  fee: number;
  memo?: string;
  tradedAt: Date;
  isManual: boolean;
}

// 브릿지 상태
export interface BridgeStatus {
  connected: boolean;
  version?: string;
  hanaConnected?: boolean;
  lastSync?: Date;
}

// API 응답
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 페이지네이션
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
