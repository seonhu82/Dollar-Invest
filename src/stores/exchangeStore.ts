import { create } from "zustand";
import { ExchangeRateData } from "@/types";

interface ExchangeState {
  rates: Record<string, ExchangeRateData>;
  isLoading: boolean;
  lastUpdated: Date | null;
  fetchRates: () => Promise<void>;
  getRate: (currency: string) => ExchangeRateData | null;
}

export const useExchangeStore = create<ExchangeState>((set, get) => ({
  rates: {},
  isLoading: false,
  lastUpdated: null,

  fetchRates: async () => {
    set({ isLoading: true });
    try {
      const response = await fetch("/api/exchange/rates");
      if (response.ok) {
        const data = await response.json();
        const ratesMap: Record<string, ExchangeRateData> = {};

        for (const rate of data.rates) {
          ratesMap[rate.currency] = {
            ...rate,
            timestamp: new Date(rate.timestamp),
          };
        }

        set({
          rates: ratesMap,
          isLoading: false,
          lastUpdated: new Date(),
        });
      }
    } catch (error) {
      console.error("Failed to fetch rates:", error);
      set({ isLoading: false });
    }
  },

  getRate: (currency: string) => {
    return get().rates[currency] || null;
  },
}));
