// lib/photo.ts — kompres foto bukti ke data URL JPEG (sisi terpanjang ≤ 1024 px) di klien.
// Pola sama dengan foto bukti bayar di CheckoutModal; dipakai bukti kirim transfer.

export function compressImageToDataUrl(file: File, maxSide = 1024, quality = 0.7): Promise<string> {
  const readRaw = () =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Gagal membaca foto."));
      reader.readAsDataURL(file);
    });

  return new Promise<string>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch {
        readRaw().then(resolve, reject);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      readRaw().then(resolve, reject);
    };
    img.src = url;
  });
}
