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
  /** 2026-11-20: Mode Latihan — checkout disimulasikan, tidak ditulis ke DB (components/TrainingModeControl) */
  trainingMode: boolean;
  /** 2026-11-21: cetak nota & label lewat app pembantu Android "Kebaya Oma Print" (lib/print-helper) */
  printHelper: boolean;
}

interface SettingsState extends Settings {
  update: (patch: Partial<Settings>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      storeName: "Kebaya Oma",
      address: "", // alamat & telepon per outlet diambil dari data toko (lib/store-info)
      phone: "",
      taxRate: 0, // E4: default OFF; model inclusive, manager mengisi % bila perlu
      printerType: "escpos-bluetooth",
      cashierName: "Ani",
      trainingMode: false,
      printHelper: false,
      update: (patch) => set(patch),
    }),
    {
      name: "kebaya-oma-settings",
      version: 3,
      // AC-E4#2: perangkat lama tersimpan taxRate 12 (model exclusive lama) → 0 saat rilis.
      migrate: (state: unknown) => {
        const s = state as { taxRate?: number } & Record<string, unknown>;
        if (s && typeof s.taxRate === "number" && s.taxRate !== 0) s.taxRate = 0;
        // v3 (2026-11-20): buang alamat/telepon contoh yang tersimpan di perangkat lama
        if (s && s.address === "Jl. Sudirman No. 123, Jakarta") s.address = "";
        if (s && s.phone === "021-1234-5678") s.phone = "";
        return s as unknown as SettingsState;
      },
    }
  )
);
