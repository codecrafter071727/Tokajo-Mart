-- catalog: home screen banners, managed by admins. Owned by the catalog service.
-- A banner shows while it is active and now is inside its optional start and end time.

create table catalog.banners (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (length(trim(title)) > 0),
  subtitle     text not null default '',
  image_url    text,
  -- Where a tap goes: a category, a product, or nowhere
  link_type    text not null default 'none' check (link_type in ('category', 'product', 'none')),
  link_target  text,
  color        text not null default '#E8F5E9',
  sort_order   integer not null default 0,
  active       boolean not null default true,
  starts_at    timestamptz,
  ends_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint banners_link_has_target check (
    (link_type = 'none' and link_target is null) or (link_type <> 'none' and link_target is not null)
  ),
  constraint banners_window_ordered check (starts_at is null or ends_at is null or starts_at < ends_at)
);

create index banners_live_idx on catalog.banners (sort_order) where active;

create trigger banners_updated_at before update on catalog.banners
  for each row execute function public.set_updated_at();
