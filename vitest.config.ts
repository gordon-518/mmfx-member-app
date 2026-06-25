import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Tests run in Node. Two aliases:
//  - "server-only" → a no-op stub (the real package throws outside RSC).
//  - "@/..." → ./src (regex-bounded so it never catches "@supabase/...").
const src = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: "server-only", replacement: `${src}/test/empty.ts` },
      { find: /^@\/(.*)$/, replacement: `${src}/$1` },
    ],
  },
});
