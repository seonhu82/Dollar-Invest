import { create } from "zustand";

interface BridgeState {
  // 연결 상태
  connected: boolean;
  hanaConnected: boolean;
  version: string | null;

  // 로딩 상태
  isChecking: boolean;
  error: string | null;

  // 액션
  checkStatus: () => Promise<void>;
  connect: () => Promise<boolean>;
  login: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  setError: (error: string | null) => void;
}

const BRIDGE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL || "http://127.0.0.1:8585";

export const useBridgeStore = create<BridgeState>((set) => ({
  connected: false,
  hanaConnected: false,
  version: null,
  isChecking: false,
  error: null,

  checkStatus: async () => {
    set({ isChecking: true, error: null });
    try {
      const response = await fetch(`${BRIDGE_URL}/api/status`, {
        method: "GET",
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) {
        throw new Error("브릿지 응답 오류");
      }

      const data = await response.json();
      set({
        connected: data.connected ?? false,
        hanaConnected: data.hanaConnected ?? false,
        version: data.version ?? null,
        isChecking: false,
      });
    } catch {
      set({
        connected: false,
        hanaConnected: false,
        version: null,
        isChecking: false,
      });
    }
  },

  connect: async () => {
    set({ isChecking: true, error: null });
    try {
      const response = await fetch(`${BRIDGE_URL}/api/hana/connect`, {
        method: "POST",
        signal: AbortSignal.timeout(10000),
      });

      const data = await response.json();
      if (data.success) {
        set({ connected: true, isChecking: false });
        return true;
      } else {
        set({ error: data.error || "연결 실패", isChecking: false });
        return false;
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "연결 실패";
      set({ error: errorMsg, isChecking: false });
      return false;
    }
  },

  login: async () => {
    set({ isChecking: true, error: null });
    try {
      const response = await fetch(`${BRIDGE_URL}/api/hana/login`, {
        method: "POST",
        signal: AbortSignal.timeout(60000), // 로그인은 60초 대기
      });

      const data = await response.json();
      if (data.success) {
        set({ hanaConnected: true, isChecking: false });
        return true;
      } else {
        set({ error: data.error || "로그인 실패", isChecking: false });
        return false;
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "로그인 실패";
      set({ error: errorMsg, isChecking: false });
      return false;
    }
  },

  disconnect: async () => {
    try {
      await fetch(`${BRIDGE_URL}/api/hana/logout`, {
        method: "POST",
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // 무시
    }
    set({ hanaConnected: false });
  },

  setError: (error) => set({ error }),
}));
