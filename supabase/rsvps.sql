-- RSVP storage for the wedding site.
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

create table if not exists public.rsvps (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  name          text not null check (char_length(name) between 2 and 80),
  -- One RSVP per email; submitting again updates it.
  email         text not null unique check (email = lower(email)),
  phone         text check (char_length(phone) <= 24),
  attending     boolean not null,
  guests        smallint not null default 1 check (guests between 0 and 10),
  events        text[] not null default '{}',
  message       text check (char_length(message) <= 600),
  email_sent_at timestamptz,
  email_error   text
);

create index if not exists rsvps_created_at_idx on public.rsvps (created_at desc);

-- Row Level Security on with no policies: the public (anon) key can neither
-- read nor write. Only the website's server, using the service-role key, can.
alter table public.rsvps enable row level security;

-- Headcount per event, for the family to check in the Table Editor.
create or replace view public.rsvp_event_totals
with (security_invoker = true) as
select e as event,
       count(*)          as households,
       sum(r.guests)     as guests
from public.rsvps r, unnest(r.events) as e
where r.attending
group by e
order by array_position(array['nikah','mehndi','baraat','valima'], e);
