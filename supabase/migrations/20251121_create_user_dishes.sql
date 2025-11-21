create table if not exists public.user_dishes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  name text not null,
  category text not null,
  image_url text,
  ingredients text default '' not null,
  cooking_steps text,
  calories numeric,
  protein numeric,
  carbs numeric,
  fat numeric,
  is_meat boolean,
  created_at timestamp with time zone default now()
);

alter table public.user_dishes enable row level security;

create policy if not exists "user can select own dishes" on public.user_dishes
  for select using (auth.uid() = user_id);

create policy if not exists "user can insert own dishes" on public.user_dishes
  for insert with check (auth.uid() = user_id);

create policy if not exists "user can update own dishes" on public.user_dishes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy if not exists "user can delete own dishes" on public.user_dishes
  for delete using (auth.uid() = user_id);

