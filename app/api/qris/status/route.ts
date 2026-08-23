import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref");
  const number = req.nextUrl.searchParams.get("number");

  if (!ref && !number) {
    return NextResponse.json({ error: "ref or number required" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json({ mock: true, status: "pending" });
  }

  const supabase = createClient(url, serviceKey);

  let query = supabase
    .from("transactions")
    .select("id, number, status, payment_status, qris_ref")
    .limit(1);

  if (ref) {
    query = query.eq("qris_ref", ref);
  } else if (number) {
    query = query.eq("number", number);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    return NextResponse.json({ status: "not_found" });
  }

  // If gateway key exists, also check gateway status (optional)
  const gateway = process.env.QRIS_GATEWAY || "midtrans";
  const midtransKey = process.env.MIDTRANS_SERVER_KEY;
  let gatewayStatus: string | null = null;

  if (midtransKey && data.qris_ref && data.status !== "paid") {
    try {
      const auth = Buffer.from(midtransKey + ":").toString("base64");
      const res = await fetch(
        `https://api.sandbox.midtrans.com/v2/${data.qris_ref}/status`,
        {
          headers: {
            Accept: "application/json",
            Authorization: "Basic " + auth,
          },
        }
      );
      if (res.ok) {
        const gData = await res.json();
        gatewayStatus = gData.transaction_status;

        // If gateway says settled but DB still pending, update DB
        if (
          (gatewayStatus === "capture" || gatewayStatus === "settlement") &&
          data.status !== "paid"
        ) {
          await supabase
            .from("transactions")
            .update({ status: "paid", payment_status: "paid" })
            .eq("id", data.id);
          return NextResponse.json({
            status: "paid",
            gateway_status: gatewayStatus,
            source: "gateway_poll",
          });
        }
      }
    } catch {
      // Gateway poll failed, fall through to DB status
    }
  } else if (gateway === "gopay" && process.env.GOPAY_MERCHANT_KEY && data.qris_ref) {
    try {
      const res = await fetch(
        `https://api.gopay.co.id/v1/merchant/qr/${data.qris_ref}`,
        {
          headers: {
            Accept: "application/json",
            "API-Key": process.env.GOPAY_MERCHANT_KEY,
          },
        }
      );
      if (res.ok) {
        const gData = await res.json();
        gatewayStatus = gData.status;

        if (gatewayStatus === "PAID" && data.status !== "paid") {
          await supabase
            .from("transactions")
            .update({ status: "paid", payment_status: "paid" })
            .eq("id", data.id);
          return NextResponse.json({
            status: "paid",
            gateway_status: gatewayStatus,
            source: "gateway_poll",
          });
        }
      }
    } catch {
      // Gateway poll failed
    }
  }

  return NextResponse.json({
    status: data.status,
    payment_status: data.payment_status,
    gateway_status: gatewayStatus,
    source: "db",
  });
}
