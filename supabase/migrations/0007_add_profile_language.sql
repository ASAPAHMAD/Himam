-- Milestone 2.5 — Profile Language Configuration.
--
-- Adds cloud persistence for `Profile.language`.
-- Adds language text column defaulting to 'en'.

alter table public.profiles
  add column if not exists language text not null default 'en';
