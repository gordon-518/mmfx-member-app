-- ============================================================================
-- Rollout cleanup for 20260915000005: the Telegram-aware 6-argument
-- fn_submit_deposit is live in the deployed app, so the old 5-argument
-- overload (no Telegram username) is dropped. Nothing calls it any more, and
-- leaving it would let a hand-crafted request skip the required field.
-- ============================================================================

drop function if exists public.fn_submit_deposit(text, text, numeric, text, text);
