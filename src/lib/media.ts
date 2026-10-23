// Media hosted outside this app.
//
// The AI Trading Assistant walkthrough lives in the marketing site's public
// folder, where it is already deployed and CDN-cached. Pointing at that one
// copy keeps a 31 MB binary out of this repo's history — the trade is that the
// player here depends on marketmakersfx.net continuing to serve the path. If
// that ever moves (Gumlet is the better long-term home for video), this is the
// single line to change.
export const AITA_VSL_URL = "https://www.marketmakersfx.net/video/aita-vsl.mp4";
