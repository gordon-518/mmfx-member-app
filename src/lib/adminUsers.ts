import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role GoTrue admin wrappers for the /admin user-management panel.
// Server-only; only ever invoked from is_admin-gated server actions. Never
// import into client code.

let admin: SupabaseClient | null = null;
function adminClient(): SupabaseClient {
  if (!admin) {
    admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return admin;
}

// Ban (reversible) or unban a user. A far-future ban_duration disables login;
// "none" clears it.
export async function banUserById(id: string, ban: boolean): Promise<{ ok: boolean; error?: string }> {
  const { error } = await adminClient().auth.admin.updateUserById(id, {
    ban_duration: ban ? "876000h" : "none",
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

// Permanent hard delete of an auth user (cascades the profile).
export async function deleteUserById(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await adminClient().auth.admin.deleteUser(id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
