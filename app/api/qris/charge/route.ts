import { NextRequest, NextResponse } from "next/server";

function mockResponse(gross_amount: number) {
  const ref = "QRX-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  return NextResponse.json({
    mock: true,
    gateway: "mock",
    qrisRef: ref,
    qrString: `00020101021226ID.CO.KEBAYAOMA.WWW011893600912345678${ref}5204583253033605802ID5909KEBAYAOMA6011JAKARTASELAT6304${String(gross_amount).padStart(10, "0")}`,
    expiry: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  });
}

export async function POST(req: NextRequest) {
  const { gross_amount } = await req.json();
  const storeId = process.env.NEXT_PUBLIC_STORE_ID || "unknown";
  const gateway = process.env.QRIS_GATEWAY || "midtrans";

  // No gateway configured — sandbox mock
  const midtransKey = process.env.MIDTRANS_SERVER_KEY;
  const gopayKey = process.env.GOPAY_MERCHANT_KEY;
  if (!midtransKey && !gopayKey) return mockResponse(gross_amount);

  const orderId = `POS-${storeId}-${Date.now()}`;

  try {
    if (gateway === "gopay" && gopayKey) {
      // GoPay Merchant — QRIS dinamis ber-nominal.
      // Endpoint/header mengikuti spesifikasi GoPay Merchant API; sesuaikan
      // dengan dokumentasi merchant jika berbeda.
      const res = await fetch("https://api.gopay.co.id/v1/merchant/qris", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "API-Key": gopayKey,
        },
        body: JSON.stringify({
          reference_id: orderId,
          amount: gross_amount,
          currency: "IDR",
          expiry_time: 300, // detik (5 menit)
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ error: err }, { status: 502 });
      }
      const data = await res.json();
      return NextResponse.json({
        mock: false,
        gateway: "gopay",
        qrisRef: data.qr_id || data.reference_id || orderId,
        qrString: data.qr_string || data.qr_content,
        orderId: orderId,
        expiry: data.expiry_time,
      });
    }

    // Midtrans (default)
    const auth = Buffer.from(midtransKey + ":").toString("base64");
    const body = {
      payment_type: "qris",
      transaction_details: { order_id: orderId, gross_amount },
      qris: { expiry: { duration: 5, unit: "minute" } },
    };
    const resMid = await fetch("https://app.sandbox.midtrans.com/v2/charge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: "Basic " + auth,
      },
      body: JSON.stringify(body),
    });

    if (!resMid.ok) {
      const err = await resMid.text();
      return NextResponse.json({ error: err }, { status: 502 });
    }
    const data = await resMid.json();
    return NextResponse.json({
      mock: false,
      gateway: "midtrans",
      qrisRef: data.transaction_id,
      qrString: data.qr_string,
      orderId: data.order_id,
      expiry: data.expiry_time,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}