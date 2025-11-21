-- Enable extension for UUID generation
create extension if not exists "pgcrypto";

-- User selections table
create table if not exists public.user_selections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  dish_ids text[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint user_selections_user_unique unique (user_id)
);

create index if not exists user_selections_user_id_idx on public.user_selections(user_id);

alter table public.user_selections enable row level security;

create policy "user_selections_select_own" on public.user_selections
  for select using (auth.uid() = user_id);

create policy "user_selections_insert_own" on public.user_selections
  for insert with check (auth.uid() = user_id);

create policy "user_selections_update_own" on public.user_selections
  for update using (auth.uid() = user_id);

create policy "user_selections_delete_own" on public.user_selections
  for delete using (auth.uid() = user_id);

-- Shopping cart table
create table if not exists public.shopping_cart (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  ingredients_json text,
  updated_at timestamptz not null default now(),
  constraint shopping_cart_user_unique unique (user_id)
);

create index if not exists shopping_cart_user_id_idx on public.shopping_cart(user_id);

alter table public.shopping_cart enable row level security;

create policy "shopping_cart_select_own" on public.shopping_cart
  for select using (auth.uid() = user_id);

create policy "shopping_cart_insert_own" on public.shopping_cart
  for insert with check (auth.uid() = user_id);

create policy "shopping_cart_update_own" on public.shopping_cart
  for update using (auth.uid() = user_id);

create policy "shopping_cart_delete_own" on public.shopping_cart
  for delete using (auth.uid() = user_id);

-- Meal history table
create table if not exists public.meal_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  dish_ids text[] not null,
  meal_date date not null,
  dishes jsonb not null,
  total_calories double precision not null default 0,
  total_protein double precision not null default 0,
  total_carbs double precision not null default 0,
  total_fat double precision not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists meal_history_user_id_idx on public.meal_history(user_id);
create index if not exists meal_history_date_idx on public.meal_history(meal_date);

alter table public.meal_history enable row level security;

create policy "meal_history_select_own" on public.meal_history
  for select using (auth.uid() = user_id);

create policy "meal_history_insert_own" on public.meal_history
  for insert with check (auth.uid() = user_id);

create policy "meal_history_update_own" on public.meal_history
  for update using (auth.uid() = user_id);

create policy "meal_history_delete_own" on public.meal_history
  for delete using (auth.uid() = user_id);