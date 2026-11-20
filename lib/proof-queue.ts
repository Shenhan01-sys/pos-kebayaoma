// lib/proof-queue.ts — foto bukti bayar diunggah SESUDAH transaksi tersimpan (keluhan staf 2026-11-20 no. 2:
// "bukti foto lama loadingnya"). Dulu foto base64 ikut insert header transaksi → kasir menunggu unggahan.
// Sekarang transaksi disimpan tanpa foto, lalu foto dikirim di belakang (UPDATE photo_proof; trigger
// transactions hanya `UPDATE OF status`, jadi tidak ada efek samping). Foto dicatat dulu di localStorage
// agar tetap terkirim walau PWA dimatikan Android (mis. saat RawBT mencetak); dikirim ulang saat app dibuka.

export const PROOF_QUEUE_KEY = "kebaya-oma-pending-proofs";
/** foto yang tertahan lebih lama dari ini dibuang (transaksi tetap ada, hanya tanpa foto) */
export const PROOF_TTL_MS = 3 * 24 * 60 * 60 * 1000;

export interface PendingProof {
  txId: string;
  photo: string;
  at: number;
}

export function parseProofQueue(raw: string | null | undefined, now: number): PendingProof[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter(
      (p): p is PendingProof =>
        !!p && typeof p.txId === "string" && typeof p.photo === "string" && typeof p.at === "number" && now - p.at <= PROOF_TTL_MS
    );
  } catch {
    return [];
  }
}

function read(): PendingProof[] {
  try {
    return parseProofQueue(localStorage.getItem(PROOF_QUEUE_KEY), Date.now());
  } catch {
    return [];
  }
}

function write(list: PendingProof[]) {
  try {
    if (list.length) localStorage.setItem(PROOF_QUEUE_KEY, JSON.stringify(list));
    else localStorage.removeItem(PROOF_QUEUE_KEY);
  } catch {
    /* kuota penuh / diblokir: unggahan langsung tetap dicoba */
  }
}

export function enqueueProof(txId: string, photo: string) {
  write([...read().filter((p) => p.txId !== txId), { txId, photo, at: Date.now() }]);
}

export function dequeueProof(txId: string) {
  write(read().filter((p) => p.txId !== txId));
}

/** coba kirim satu foto, sampai `tries` kali; sukses → dikeluarkan dari antrean */
export async function sendProof(
  p: Pick<PendingProof, "txId" | "photo">,
  attach: (txId: string, photo: string) => Promise<string | null>,
  tries = 3
): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    const err = await attach(p.txId, p.photo);
    if (!err) {
      dequeueProof(p.txId);
      return true;
    }
    if (i < tries - 1) await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  return false;
}

let flushing = false;
/** kirim ulang foto yang tertahan (dipanggil saat sesi login siap) */
export async function flushProofQueue(attach: (txId: string, photo: string) => Promise<string | null>) {
  if (flushing) return;
  flushing = true;
  try {
    for (const p of read()) await sendProof(p, attach, 1);
  } finally {
    flushing = false;
  }
}
