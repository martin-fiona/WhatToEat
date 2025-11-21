-- 清理 shopping_cart 的重复行，仅保留每个 user_id 最新一条
with ranked as (
  select id, user_id, updated_at,
         row_number() over (partition by user_id order by updated_at desc, id desc) as rn
  from public.shopping_cart
)
delete from public.shopping_cart sc
using ranked r
where sc.id = r.id and r.rn > 1;

-- 为 shopping_cart.user_id 添加唯一索引，支持 ON CONFLICT (user_id)
create unique index if not exists shopping_cart_user_uidx on public.shopping_cart(user_id);

-- 清理 user_selections 的重复行，仅保留每个 user_id 最新一条
with ranked_sel as (
  select id, user_id, updated_at,
         row_number() over (partition by user_id order by updated_at desc, id desc) as rn
  from public.user_selections
)
delete from public.user_selections us
using ranked_sel r
where us.id = r.id and r.rn > 1;

-- 为 user_selections.user_id 添加唯一索引，支持 ON CONFLICT (user_id)
create unique index if not exists user_selections_user_uidx on public.user_selections(user_id);