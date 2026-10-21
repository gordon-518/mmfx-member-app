import { NextResponse } from "next/server";
import { deskAuthorized } from "@/lib/fa/guard";
import { getDeskPrice } from "@/lib/fa/desk";
import { deskInstrument } from "@/lib/fa/types";

// Live spot for the Fundamental Desk's thesis view, proxied. The desk's price
// endpoint is public, but the browser polls this instead so the desk host
// never appears in a member's network tab and the poll carries no cross-origin
// request. Uncached by design — spot is the one number that must be current.

export async function GET(req: Request) {
  if (!(await deskAuthorized())) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  // The desk silently answers with gold for an unknown ?instrument=, so an id
  // outside the registry is rejected here rather than passed through.
  const id = new URL(req.url).searchParams.get("instrument");
  const instrument = deskInstrument(id);
  if (!instrument) {
    return NextResponse.json({ ok: false, reason: "bad_instrument" }, { status: 400 });
  }

  const quote = await getDeskPrice(instrument.id);
  if (!quote) {
    return NextResponse.json({ ok: false, reason: "price_unavailable" }, { status: 502 });
  }

  return NextResponse.json(
    {
      ok: true,
      instrument: instrument.id,
      price: quote.price,
      symbol: quote.symbol || instrument.display,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
