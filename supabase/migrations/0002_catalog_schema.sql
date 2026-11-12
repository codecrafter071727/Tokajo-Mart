-- catalog: what we sell. Owned by the catalog service.
-- Ids are stable text slugs (p1, dairy) so apps, seeds and URLs stay readable.

create schema if not exists catalog;

create table catalog.categories (
  id          text primary key,
  name        text not null check (length(trim(name)) > 0),
  emoji       text not null default '',
  color       text not null default '#F3F6F5',
  image_url   text,
  image_fit   text not null default 'cover' check (image_fit in ('cover', 'contain')),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table catalog.products (
  id              text primary key,
  category_id     text not null references catalog.categories (id),
  name            text not null check (length(trim(name)) > 0),
  unit            text not null default '',
  price_paise     integer not null check (price_paise >= 0),
  mrp_paise       integer not null check (mrp_paise >= 0),
  emoji           text not null default '',
  image_url       text,
  image_fit       text not null default 'contain' check (image_fit in ('cover', 'contain')),
  delivery_mins   integer not null default 10 check (delivery_mins > 0),
  options_count   integer check (options_count is null or options_count > 0),
  description     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  constraint products_price_not_above_mrp check (price_paise <= mrp_paise)
);

create index products_category_idx on catalog.products (category_id) where deleted_at is null;
-- Trigram index so search matches the middle of words and tolerates small typos
create index products_name_trgm_idx on catalog.products using gin (lower(name) gin_trgm_ops);

create trigger categories_updated_at before update on catalog.categories
  for each row execute function public.set_updated_at();
create trigger products_updated_at before update on catalog.products
  for each row execute function public.set_updated_at();
