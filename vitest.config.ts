import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Tests run in Node. Two aliases:
//  - "server-only" → a no-op stub (the real package throws outside RSC).
//  - "@/..." → ./src (regex-bounded so it never catches "@supabase/...").
const src = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  test: {
    // Git worktrees live under .claude/worktrees and carry a full copy of src.
    // Without this, vitest globs both trees: the suite runs twice and a stale
    // worktree copy can fail against current code.
    exclude: ["**/node_modules/**", "**/dist/**", "**/.claude/worktrees/**"],
  },
  resolve: {
    alias: [
      { find: "server-only", replacement: `${src}/test/empty.ts` },
      { find: /^@\/(.*)$/, replacement: `${src}/$1` },
    ],
  },
});
