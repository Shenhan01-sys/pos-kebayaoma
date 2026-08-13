import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  const { order_id, gross_amount } = await req.json();

  const storeId = process.env.NEXT_PUBLIC_STORE_ID || "unknown";

  if (!serverKey) {
    // No Midtrans keys — return mock QR for sandbox
    const ref = "QRX-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    return NextResponse.json({
      mock: true,
      qrisRef: ref,
      qrString: `00020101021226ID.CO.KEBAYAOMA.WWW011893600912345678${ref}5204583253033605802ID5909KEBAYAOMA6011JAKARTASELAT6304${String(gross_amount).padStart(10, "0")}`,
      expiry: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });
  }

  try {
    const auth = Buffer.from(serverKey + ":").toString("base64");
    const body = {
      payment_type: "qris",
      transaction_details: {
        order_id: `POS-${storeId}-${Date.now()}`,
        gross_amount,
      },
      qris: {
        expiry: { duration: 5, unit: "minute" },
      },
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
      qrisRef: data.transaction_id,
      qrString: data.qr_string,
      orderId: data.order_id,
      expiry: data.expiry_time,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}