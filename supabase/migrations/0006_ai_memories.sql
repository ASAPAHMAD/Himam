-- Phase 3.1 — AI Memory
--
-- Create the `ai_memories` table to store structured, long-term memory for the AI Coach.

create table if not exists public.ai_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null, -- 'weakness' | 'strength' | 'preference' | 'habit' | 'goal' | 'milestone' | 'motivation'
  importance smallint not null check (importance >= 1 and importance <= 10),
  confidence decimal(3,2) not null check (confidence >= 0.0 and confidence <= 1.0),
  summary text not null,
  source text not null default 'conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  last_used_at timestamptz
);

-- Enable Row Level Security (RLS)
alter table public.ai_memories enable row level security;

-- Policies for owner access
create policy "ai_memories: select own" on public.ai_memories
  for select using (auth.uid() = user_id);

create policy "ai_memories: insert own" on public.ai_memories
  for insert with check (auth.uid() = user_id);

create policy "ai_memories: update own" on public.ai_memories
  for update using (auth.uid() = user_id);

create policy "ai_memories: delete own" on public.ai_memories
  for delete using (auth.uid() = user_id);
