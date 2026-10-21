import { NextResponse } from "next/server";
import { deskAuthorized } from "@/lib/fa/guard";
import { deskReportUrl } from "@/lib/fa/desk";
import { deskInstrument } from "@/lib/fa/types";

// "Download PDF" on the thesis view. The desk's report endpoint is public;
// proxying it keeps the download same-origin (no desk hostname in the UI) and
// members-only, and it reuses the same instrument allowlist as everything else.

const PDF_TIMEOUT_MS = 15_000;

export async function GET(req: Request) {
  if (!(await deskAuthorized())) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("instrument");
  const instrument = deskInstrument(id);
  if (!instrument) {
    return NextResponse.json({ ok: false, reason: "bad_instrument" }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(deskReportUrl(instrument.id), {
      signal: AbortSignal.timeout(PDF_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ ok: false, reason: "pdf_unavailable" }, { status: 502 });
  }
  if (!res.ok || !res.body) {
    return NextResponse.json({ ok: false, reason: "pdf_unavailable" }, { status: 502 });
  }

  const filename = `${instrument.id.toLowerCase()}_thesis.pdf`;
  return new NextResponse(res.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
