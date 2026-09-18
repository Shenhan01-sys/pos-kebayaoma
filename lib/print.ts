// lib/print.ts — util print via hidden iframe (popup-free, ramah tablet Android).
// @page di dalam iframe terisolasi dari CSS utama → tiap jenis print punya ukuran
// kertas sendiri (nota thermal 58mm, label 40mm, dst) tanpa saling menimpa.

export function printHtmlViaIframe(html: string): void {
  if (typeof document === "undefined") return;
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  const win = iframe.contentWindow!;
  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } finally {
      setTimeout(() => iframe.remove(), 1500);
    }
  }, 350);
}
