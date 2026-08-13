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

  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (serverKey) {
    const signatureKey = createHash("sha512")
      .update(
        `${data.order_id}${data.status_code}${data.gross_amount}${serverKey}`
      )
      .digest("hex");
    if (signatureKey !== data.signature_key) {
      return NextResponse.json({ error: "invalid signature" }, { status: 403 });
    }
  }

  // Only finalize on settlement/capture
  if (!["settlement", "capture"].includes(data.transaction_status)) {
    return NextResponse.json({ received: true, skipped: data.transaction_status });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, serviceKey);

  const orderId = data.order_id;
  const qrisRef = data.transaction_id || orderId;

  // Match by transaction number or qris_ref
  const { data: tx, error } = await supabase
    .from("transactions")
    .select("id, status")
    .or(`number.eq.${orderId},qris_ref.eq.${qrisRef}`)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!tx) return NextResponse.json({ received: true, notFound: true });

  await supabase
    .from("transactions")
    .update({ status: "paid", payment_status: "paid", qris_ref: qrisRef })
    .eq("id", tx.id);

  return NextResponse.json({ received: true, status: "paid" });
}