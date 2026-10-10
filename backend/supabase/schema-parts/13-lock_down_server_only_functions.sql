-- ============================================================================
-- Part 13 of 16: lock_down_server_only_functions
--
-- Paste this whole file into the Supabase SQL editor and Run, then move on
-- to the next part. Run them in order; each one is safe to run twice.
-- ============================================================================

-- ============================================================================
-- Take back what Supabase's default privileges handed out.
--
-- Every migration before this one locked a server-only function with
--
--   revoke all on function public.<fn>(...) from public;
--
-- which revokes the PUBLIC pseudo-role's implicit grant. On a real Supabase
-- project that is not enough. A project ships with
--
--   alter default privileges in schema public
--     grant all on functions to postgres, anon, authenticated, service_role;
--
-- so every function created afterwards carries an EXPLICIT grant to anon and
-- authenticated. Revoking from PUBLIC does not touch an explicit grant to a
-- named role, so the revoke ran, reported success, and left the function
-- reachable with the publishable key that ships in the browser bundle.
--
-- It did not show up in the test suite because the scratch database the suite
-- builds had no such default privileges: there, revoking from PUBLIC really
-- was enough, and every grant assertion passed. The harness has been fixed to
-- set those default privileges too, so this class of mistake fails a test
-- instead of reaching production.
--
-- The one that mattered:
--
--   start_email_verification() mints the six-digit code and RETURNS THE
--   PLAINTEXT. Reachable from the browser, confirming an address you do not
--   own is two calls -- ask for the code, read it out of the response, hand it
--   straight back to verify_email_code() -- and the email gate in front of
--   every booking stops meaning anything.
--
-- The others are smaller but wrong for the same reason: is_email_verified()
-- answers whether an address has confirmed, and note_lookup() is the shared
-- throttle behind the three booking lookups, so calling it directly burns
-- another address's quota.
--
-- set_booking_status() is on this list for tidiness rather than repair: it
-- tests is_admin() itself and raises 'Not authorised', so it was never open.
-- The trigger functions are here because nothing should ever call them by
-- hand; they exist to be fired by a trigger.
-- ============================================================================

-- ---------------------------------------------------- the code minter and co

revoke all on function public.start_email_verification(text)
  from public, anon, authenticated;
revoke all on function public.is_email_verified(text)
  from public, anon, authenticated;
revoke all on function public.note_lookup(text, text, integer)
  from public, anon, authenticated;

-- The Edge Functions call these with the service_role key, and nothing else
-- should be able to.
grant execute on function public.start_email_verification(text) to service_role;
grant execute on function public.is_email_verified(text)        to service_role;
grant execute on function public.note_lookup(text, text, integer) to service_role;

-- ------------------------------------------------------------- admin actions

-- authenticated keeps it: an admin is a signed-in user, and the function
-- checks is_admin() before doing anything.
revoke all on function public.set_booking_status(uuid, public.booking_status, text)
  from public, anon;
grant execute on function public.set_booking_status(uuid, public.booking_status, text)
  to authenticated;

-- --------------------------------------------------------- trigger functions

revoke all on function public.log_booking_change()  from public, anon, authenticated;
revoke all on function public.log_settings_change() from public, anon, authenticated;
revoke all on function public.log_chalet_change()   from public, anon, authenticated;
revoke all on function public.touch_updated_at()    from public, anon, authenticated;

-- ----------------------------------------------------------------- from here

-- Stop the default privileges handing out the next one too. This is scoped to
-- the role that owns these objects, so it does not touch anything Supabase
-- creates elsewhere; a future migration adding a server-only function still
-- has to revoke explicitly, and the test suite now checks that it did.
do $$
begin
  execute format(
    'alter default privileges for role %I in schema public revoke execute on functions from anon, authenticated',
    current_user);
exception when others then
  -- Not fatal: the explicit revokes above are the fix, this only narrows the
  -- default for objects created later by this same role.
  raise notice 'could not narrow default privileges: %', sqlerrm;
end $$;
