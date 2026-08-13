import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export async function POST(req: NextRequest) {
  const body = await req.text();
  let data: any;
  try {
    data = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const gateway = process.env.QRIS_GATEWAY || "midtrans";

  // Verify signature berdasarkan gateway
  if (gateway === "gopay") {
    const gopayKey = process.env.GOPAY_MERCHANT_KEY;
    if (gopayKey) {
      // GoPay Merchant: verifikasi HMAC-SHA256 dari header/callback body
      // Sesuaikan dengan spesifikasi GoPay Merchant API docs
      const receivedSig =
        req.headers.get("x-signature") ||
        req.headers.get("X-Callback-Signature") ||
        "";
      const computedSig = createHash("sha256")
        .update(body + gopayKey)
        .digest("hex");
      if (receivedSig !== computedSig) {
        return NextResponse.json({ error: "invalid signature" }, { status: 403 });
      }
    }
  } else {
    // Midtrans: signature_key = SHA512(order_id + status_code + gross_amount + server_key)
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (serverKey) {
      const expectedSig = createHash("sha512")
        .update(
          `${data.order_id}${data.status_code}${data.gross_amount}${serverKey}`
        )
        .digest("hex");
      if (expectedSig !== data.signature_key) {
        return NextResponse.json({ error: "invalid signature" }, { status: 403 });
      }
    }
  }

  // Hanya finalisasi saat settlement/capture
  const statusOk =
    ["settlement", "capture"].includes(data.transaction_status) ||
    data.status === "PAID" ||
    data.status === "SETTLEMENT";

  if (!statusOk) {
    return NextResponse.json({
      received: true,
      skipped: data.transaction_status || data.status,
    });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, serviceKey);

  const qrisRef = data.transaction_id || data.qr_id || data.reference_id || "";
  const orderId = data.order_id || data.reference_id || "";

  const { data: tx } = await supabase
    .from("transactions")
    .select("id, status")
    .or(`number.eq.${orderId},qris_ref.eq.${qrisRef}`)
    .maybeSingle();

  if (!tx) return NextResponse.json({ received: true, notFound: true });

  await supabase
    .from("transactions")
    .update({ status: "paid", payment_status: "paid", qris_ref: qrisRef })
    .eq("id", tx.id);

  return NextResponse.json({ received: true, status: "paid" });
}