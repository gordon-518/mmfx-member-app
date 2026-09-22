// The brand's own typefaces, vendored so the image renderer can use them.
//
// Satori does NOT fall back to system fonts — if you hand ImageResponse no `fonts`, you
// get its generic default, which is why every organic card rendered flat next to the
// Canva templates they were meant to match. The fix is not a layout change; it is
// shipping the actual type.
//
// These are the same two families the member app sets its own pages in (see
// src/app/layout.tsx), so a post and the landing page it links to read as one brand.
// Both are SIL Open Font License — the licence files sit beside the binaries, which is
// what redistributing them in a repo requires.
//
// Weights are deliberately few. Each one is ~60-80KB inside the serverless bundle, and
// the templates only ever call for display-heavy, display-bold, body, and body-bold.
import { readFile } from "node:fs/promises";
import path from "node:path";

/** Headlines. Matches --font-display in the app. */
export const DISPLAY = "Bricolage Grotesque";
/** Body copy. Matches --font-sans in the app. */
export const BODY = "Hanken Grotesk";

export type LoadedFont = {
  name: string;
  data: Buffer;
  weight: 400 | 700 | 800;
  style: "normal";
};

const FILES: { file: string; name: string; weight: 400 | 700 | 800 }[] = [
  { file: "BricolageGrotesque-ExtraBold.ttf", name: DISPLAY, weight: 800 },
  { file: "BricolageGrotesque-Bold.ttf", name: DISPLAY, weight: 700 },
  { file: "HankenGrotesk-Regular.ttf", name: BODY, weight: 400 },
  { file: "HankenGrotesk-Bold.ttf", name: BODY, weight: 700 },
];

// Read once per process. A render is a hot path and these files never change at runtime;
// the promise (not the result) is cached so concurrent first-renders share one read.
let cached: Promise<LoadedFont[]> | undefined;

export function brandFonts(): Promise<LoadedFont[]> {
  cached ??= load();
  return cached;
}

async function load(): Promise<LoadedFont[]> {
  const dir = path.join(process.cwd(), "src", "lib", "organic", "fonts");
  return Promise.all(
    FILES.map(async ({ file, name, weight }) => {
      try {
        const data = await readFile(path.join(dir, file));
        return { name, data, weight, style: "normal" as const };
      } catch (cause) {
        // Satori's own error for a missing buffer says nothing useful, and on Vercel the
        // usual cause is the file not being traced into the bundle rather than absent.
        throw new Error(
          `organic renderer: could not read font ${file}. ` +
            `Expected it at ${dir}. If this is a deploy, check outputFileTracingIncludes.`,
          { cause }
        );
      }
    })
  );
}
