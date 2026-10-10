-- ============================================================================
-- Part 9 of 14: min_stay_one_day
--
-- Paste this whole file into the Supabase SQL editor and Run, then move on
-- to the next part. Run them in order; each one is safe to run twice.
-- ============================================================================

-- ============================================================================
-- A single night is a booking.
--
-- The minimum was three days, which refused the shortest stay the chalet is
-- happy to take. One day matches no package, so quote_stay falls through to
-- the per-day rates and prices it correctly with no further change.
--
-- The value lives in public.rates and the admin panel edits it, so this moves
-- the default and the current row rather than hard-coding anything.
-- ============================================================================

alter table public.rates alter column min_stay_days set default 1;

-- Only the old default is moved. An admin who has deliberately set some other
-- minimum keeps it, and re-running this migration does not undo their choice.
update public.rates set min_stay_days = 1 where min_stay_days = 3;
