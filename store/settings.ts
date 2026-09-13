"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Settings {
  storeName: string;
  address: string;
  phone: string;
  taxRate: number; // percent
  printerType: "escpos-bluetooth" | "browser" | "cloud";
  cashierName: string;
}

interface SettingsState extends Settings {
  update: (patch: Partial<Settings>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      storeName: "Kebaya Oma",
      address: "Jl. Sudirman No. 123, Jakarta",
      phone: "021-1234-5678",
      taxRate: 0, // E4: default OFF; model inclusive, manager mengisi % bila perlu
      printerType: "escpos-bluetooth",
      cashierName: "Ani",
      update: (patch) => set(patch),
    }),
    {
      name: "kebaya-oma-settings",
      version: 2,
      // AC-E4#2: perangkat lama tersimpan taxRate 12 (model exclusive lama) → 0 saat rilis.
      migrate: (state: unknown) => {
        const s = state as { taxRate?: number } & Record<string, unknown>;
        if (s && typeof s.taxRate === "number" && s.taxRate !== 0) s.taxRate = 0;
        return s as unknown as SettingsState;
      },
    }
  )
);
