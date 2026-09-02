"use client";

import { useEffect } from "react";
import { useData } from "@/store/data";

export default function RegisterSW() {
  const flushOfflineQueue = useData((s) => s.flushOfflineQueue);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    };
    window.addEventListener("load", onLoad);

    // Flush offline queue saat online kembali
    const flushOnOnline = () => {
      flushOfflineQueue().catch((err) =>
        console.error("[offline-queue] flush on online failed:", err)
      );
    };
    window.addEventListener("online", flushOnOnline);

    // Saat app pertama kali load dan online, cek queue
    if (navigator.onLine) {
      flushOfflineQueue().catch(() => {});
    }

    return () => {
      window.removeEventListener("load", onLoad);
      window.removeEventListener("online", flushOnOnline);
    };
  }, [flushOfflineQueue]);

  return null;
}
