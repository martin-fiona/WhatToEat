-- Allow anonymous/public read access to global dishes catalog
-- RLS remains enabled; only SELECT is allowed to all roles.

begin;

-- Create or replace policy enabling public read
drop policy if exists "allow anonymous read dishes" on public.dishes;
create policy "allow anonymous read dishes"
on public.dishes
for select
to public
using (true);

commit;