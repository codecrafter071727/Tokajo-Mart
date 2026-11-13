-- Catalog depth: sub categories, product groups (variants such as 500 ml and 1 L), more images per
-- product, brand and tags, and a weighted full text search vector. Additions only.

-- Sub categories: two levels at most (a sub category's parent has no parent). The service checks
-- the depth, because a check constraint cannot look at another row.
alter table catalog.categories add column parent_id text references catalog.categories (id);
create index categories_parent_idx on catalog.categories (parent_id) where deleted_at is null;

-- A product group holds the variants of one product. Each variant stays a separately sellable
-- product with its own price and stock, so orders and inventory need no change.
create table catalog.product_groups (
  id          text primary key,
  name        text not null check (length(trim(name)) > 0),
  category_id text not null references catalog.categories (id),
  brand       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger product_groups_updated_at before update on catalog.product_groups
  for each row execute function public.set_updated_at();

alter table catalog.products
  add column group_id      text references catalog.product_groups (id),
  add column variant_label text,
  add column brand         text,
  add column tags          text[] not null default '{}',
  add column search_vector tsvector;

create index products_group_idx on catalog.products (group_id) where deleted_at is null;
create index products_search_idx on catalog.products using gin (search_vector);

-- Extra photos. products.image_url stays the first (main) photo, so every existing reader works.
create table catalog.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  text not null references catalog.products (id) on delete cascade,
  url         text not null,
  alt         text not null default '',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index product_images_product_idx on catalog.product_images (product_id, sort_order);

-- Search vector, weighted: name A, brand B, tags, category and pack size C. It includes the
-- category name, which lives in another table, so it is kept by triggers rather than declared as a
-- generated column. The 'simple' configuration keeps brand names and Indian product words as typed.
create function catalog.product_search_vector(
  p_name text, p_brand text, p_tags text[], p_unit text, p_category text
) returns tsvector
language sql immutable as $$
  select setweight(to_tsvector('simple', coalesce(p_name, '')), 'A')
      || setweight(to_tsvector('simple', coalesce(p_brand, '')), 'B')
      || setweight(
           to_tsvector('simple',
             coalesce(array_to_string(p_tags, ' '), '') || ' ' || coalesce(p_category, '') || ' '
             || coalesce(p_unit, '')),
           'C')
$$;

create function catalog.products_refresh_search() returns trigger
language plpgsql as $$
begin
  new.search_vector := catalog.product_search_vector(
    new.name, new.brand, new.tags, new.unit,
    (select c.name from catalog.categories c where c.id = new.category_id));
  return new;
end;
$$;

create trigger products_search_vector before insert or update of name, brand, tags, unit, category_id
  on catalog.products for each row execute function catalog.products_refresh_search();

create function catalog.categories_refresh_product_search() returns trigger
language plpgsql as $$
begin
  update catalog.products p
     set search_vector = catalog.product_search_vector(p.name, p.brand, p.tags, p.unit, new.name)
   where p.category_id = new.id;
  return new;
end;
$$;

create trigger categories_search_vector after update of name on catalog.categories
  for each row execute function catalog.categories_refresh_product_search();

-- Fill the vector for the products that already exist
update catalog.products p
   set search_vector = catalog.product_search_vector(
     p.name, p.brand, p.tags, p.unit,
     (select c.name from catalog.categories c where c.id = p.category_id));
