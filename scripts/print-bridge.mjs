// scripts/print-bridge.mjs — E15: jembatan lokal POS → printer label (TSPL RAW via spooler Windows).
// Jalankan di PC yang terhubung ke printer:  npm run print-bridge
// Env: PRINT_BRIDGE_PORT (9100) · PRINTER_NAME ("Xprinter XP-D4601B") · BRIDGE_ORIGINS (daftar origin, pisah koma)
import http from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PRINT_BRIDGE_PORT || 9100);
const PRINTER = process.env.PRINTER_NAME || "Xprinter XP-D4601B";
const HERE = dirname(fileURLToPath(import.meta.url));
const PS1 = join(HERE, "rawprint.ps1");
const MAX_BYTES = 4 * 1024 * 1024;

// origin yang boleh memanggil bridge (halaman POS). Default: localhost, vercel, cloudflare tunnel.
const extra = (process.env.BRIDGE_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
const originAllowed = (o) =>
  !!o &&
  (extra.includes(o) ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o) ||
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(o) ||
    /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(o));

// hanya perintah label TSPL biasa — tolak perintah berbahaya (DOWNLOAD/KILL/EOP/FILES dll.)
// Job = byte: baris ASCII berakhir CRLF + BITMAP x,y,wBytes,h,mode,<wBytes*h byte biner>
const ALLOWED = new Set(["SIZE", "GAP", "DIRECTION", "CLS", "BARCODE", "TEXT", "BOX", "BAR", "PRINT", "DENSITY", "SPEED", "REFERENCE", "SHIFT", "QRCODE", "BITMAP"]);
const MAX_BITMAP = 64 * 1024;
function validateJob(buf) {
  if (!buf || !buf.length) return "job kosong";
  let i = 0;
  while (i < buf.length) {
    let e = i;
    while (e < buf.length && buf[e] !== 0x0a) e++; // akhir baris (header BITMAP tidak mengandung LF)
    // header ASCII = sampai koma ke-5 untuk BITMAP, selain itu sampai LF
    const head = buf.subarray(i, Math.min(e, i + 120)).toString("latin1").replace(/\r$/, "");
    if (!head) { i = e + 1; continue; }
    const cmd = head.split(/\s/)[0];
    if (!ALLOWED.has(cmd)) return "perintah tidak diizinkan: " + cmd;
    if (cmd === "BITMAP") {
      const m = /^BITMAP (\d+),(\d+),(\d+),(\d+),(\d+),/.exec(head);
      if (!m) return "header BITMAP tidak valid";
      const n = Number(m[3]) * Number(m[4]);
      if (!n || n > MAX_BITMAP) return "ukuran BITMAP tidak valid";
      i += m[0].length + n;
      if (buf[i] === 0x0d) i++;
      if (buf[i] === 0x0a) i++;
      continue;
    }
    for (let k = i; k < e; k++) if (buf[k] !== 0x0d && (buf[k] < 0x20 || buf[k] > 0x7e)) return "karakter non-ASCII pada perintah " + cmd;
    i = e + 1;
  }
  return null;
}

function rawPrint(job) {
  return new Promise((resolve, reject) => {
    const dir = mkdtempSync(join(tmpdir(), "tspl-"));
    const file = join(dir, "job.tspl");
    writeFileSync(file, job);
    const p = spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", PS1, "-Printer", PRINTER, "-File", file], { windowsHide: true });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", () => {
      rmSync(dir, { recursive: true, force: true });
      out = out.trim();
      out.startsWith("OK") ? resolve(out) : reject(new Error(out || "gagal kirim ke printer"));
    });
  });
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  // log tiap request (diagnosis: apakah browser sampai ke bridge?)
  console.log(new Date().toISOString(), req.method, req.url, "origin=" + (origin || "-"), "pna=" + (req.headers["access-control-request-private-network"] || "-"));
  const ok = originAllowed(origin);
  if (origin && ok) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
  const send = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };

  if (req.method === "OPTIONS") { res.writeHead(ok ? 204 : 403); return res.end(); }
  if (origin && !ok) return send(403, { ok: false, error: "origin tidak diizinkan" });

  if (req.method === "GET" && req.url === "/health") return send(200, { ok: true, printer: PRINTER });

  if (req.method === "POST" && req.url === "/print") {
    let size = 0; const chunks = [];
    for await (const c of req) { size += c.length; if (size > MAX_BYTES) return send(413, { ok: false, error: "payload terlalu besar" }); chunks.push(c); }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return send(400, { ok: false, error: "JSON tidak valid" }); }
    const job = typeof body.data === "string" ? Buffer.from(body.data, "base64") : typeof body.tspl === "string" ? Buffer.from(body.tspl, "latin1") : null;
    const bad = job ? validateJob(job) : "data/tspl kosong";
    if (bad) return send(400, { ok: false, error: bad });
    try {
      const r = await rawPrint(job);
      console.log(new Date().toISOString(), "print", r);
      return send(200, { ok: true, detail: r });
    } catch (e) {
      console.error(new Date().toISOString(), "print GAGAL", e.message);
      return send(500, { ok: false, error: e.message });
    }
  }
  send(404, { ok: false, error: "not found" });
});

server.listen(PORT, "127.0.0.1", () => console.log(`print-bridge aktif di http://127.0.0.1:${PORT} → printer "${PRINTER}"`));
