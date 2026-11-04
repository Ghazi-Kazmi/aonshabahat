-- Adds the names of the other people in an RSVP (everyone except the person filling the form).
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

alter table public.rsvps
  add column if not exists guest_names text[] not null default '{}';

alter table public.rsvps
  drop constraint if exists rsvps_guest_names_len;
alter table public.rsvps
  add constraint rsvps_guest_names_len check (coalesce(array_length(guest_names, 1), 0) <= 9);
