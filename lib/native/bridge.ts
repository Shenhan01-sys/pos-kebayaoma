// ============================================================================
// Native Bridge — abstraksi untuk print & scan di Capacitor vs Web
// ============================================================================

/**
 * Cek apakah aplikasi berjalan di Capacitor (native).
 */
export function isNative(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as any).Capacitor?.isNativePlatform?.();
}

/**
 * Cek apakah Bluetooth tersedia (untuk print thermal).
 * Di web, hanya BLE yang didukung. Di native, bisa pakai plugin ESC/POS.
 */
export function isBluetoothAvailable(): boolean {
  if (isNative()) {
    // Native: cek apakah plugin ESC/POS tersedia
    return true; // Asumsi tersedia jika native
  }
  // Web: cek Web Bluetooth API
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

/**
 * Print struk via native bridge atau fallback ke browser print.
 */
export async function printReceipt(html: string): Promise<boolean> {
  if (isNative()) {
    try {
      // TODO: Integrasi dengan plugin ESC/POS Capacitor
      // Contoh: await EscPosPrinter.print({ data: html, ... });
      console.info("[native] Print receipt via native bridge (belum diimplementasi)");
      return false; // Fallback ke browser
    } catch (error) {
      console.error("[native] Print error:", error);
      return false;
    }
  }

  // Fallback: browser print
  try {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return true;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { font-family: monospace; font-size: 12px; width: 80mm; }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
    return true;
  } catch {
    window.print();
    return true;
  }
}

/**
 * Scan barcode via native camera atau fallback ke html5-qrcode.
 */
export async function scanBarcode(): Promise<string | null> {
  if (isNative()) {
    try {
      // TODO: Integrasi dengan plugin BarcodeScanner Capacitor
      // Contoh: const result = await BarcodeScanner.scan();
      console.info("[native] Scan barcode via native bridge (belum diimplementasi)");
      return null; // Fallback ke web
    } catch (error) {
      console.error("[native] Scan error:", error);
      return null;
    }
  }

  // Fallback: web scan (html5-qrcode) — ditangani di komponen BarcodeScanner
  return null;
}
