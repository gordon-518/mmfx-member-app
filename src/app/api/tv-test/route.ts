import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { INDICATORS } from "@/app/indicators/data";

// Temporary debug endpoint — remove after confirming TV API works.
// GET /api/tv-test                    → whoami (which TV account are the cookies for?)
// GET /api/tv-test?extract=1          → fetch each script page and pull the REAL pine_id
// GET /api/tv-test?username=TVUSER    → run a single pine_perm/add test
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!user || isAdmin !== true) {
    return NextResponse.json({ error: "Admin only" }, { status: 401 });
  }

  const sessionId   = process.env.TV_SESSION_ID;
  const sessionSign = process.env.TV_SESSION_ID_SIGN;
  if (!sessionId || !sessionSign) {
    return NextResponse.json({ error: "TV env vars not set" }, { status: 500 });
  }

  const TV_BASE = "https://www.tradingview.com";
  const cookie = `sessionid=${sessionId}; sessionid_sign=${sessionSign}`;

  // --- extract: pull every (scriptName, scriptIdPart) pair from the author's
  // script pages. The "more from author" sidebar lists all their scripts with
  // both fields, so this gives us a name -> real pine_id map for invite-only
  // scripts (which the public suggest API can't see). ---
  if (req.nextUrl.searchParams.get("extract")) {
    const pairs = new Map<string, string>(); // pineId -> name
    for (const ind of INDICATORS) {
      if (!ind.tvUrl) continue;
      try {
        const r = await fetch(ind.tvUrl, { headers: { Cookie: cookie } });
        const html = await r.text();
        // Capture name+id in either JSON ordering within a small window.
        const patterns = [
          /"scriptIdPart"\s*:\s*"(PUB;[^"]+)"[^{}]{0,400}?"scriptName"\s*:\s*"([^"]+)"/g,
          /"scriptName"\s*:\s*"([^"]+)"[^{}]{0,400}?"scriptIdPart"\s*:\s*"(PUB;[^"]+)"/g,
        ];
        let m;
        while ((m = patterns[0].exec(html))) pairs.set(m[1], m[2]);
        while ((m = patterns[1].exec(html))) pairs.set(m[2], m[1]);
      } catch { /* ignore */ }
    }
    // Keep only MM scripts, and flag which match our 10 indicator names.
    const wanted = new Set(INDICATORS.map((i) => i.name.toLowerCase()));
    const all = [...pairs.entries()].map(([pineId, name]) => ({
      name, pineId, isOne: wanted.has(name.toLowerCase()),
    }));
    return NextResponse.json({
      matched: all.filter((x) => x.isOne),
      mmCount: all.filter((x) => x.name.toLowerCase().startsWith("mm ")).length,
      allMM: all.filter((x) => x.name.toLowerCase().startsWith("mm ")),
    });
  }

  // --- whoami ---
  let whoami: unknown = "unknown";
  try {
    const meRes = await fetch(`${TV_BASE}/`, { headers: { Cookie: cookie } });
    const html = await meRes.text();
    const m = html.match(/"username":"([^"]+)"/);
    whoami = m ? m[1] : "(username not found in homepage)";
  } catch (e) {
    whoami = `error: ${String(e)}`;
  }

  const tvUsername = req.nextUrl.searchParams.get("username");
  if (!tvUsername) {
    return NextResponse.json({ logged_in_as: whoami });
  }

  // --- add test (optionally with a custom pine_id) ---
  const testPineId = req.nextUrl.searchParams.get("pine_id") ?? "PUB;FguarHam";
  const body = new URLSearchParams({ pine_id: testPineId, username_recip: tvUsername });

  const res = await fetch(`${TV_BASE}/pine_perm/add/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookie,
      Referer: `${TV_BASE}/`,
      Origin: TV_BASE,
    },
    body: body.toString(),
  });

  const responseText = await res.text();
  let responseJson: unknown;
  try { responseJson = JSON.parse(responseText); } catch { responseJson = responseText; }

  return NextResponse.json({
    logged_in_as: whoami,
    pine_id: testPineId,
    tv_username: tvUsername,
    status: res.status,
    ok: res.ok,
    response: responseJson,
  });
}
