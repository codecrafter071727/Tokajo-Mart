-- identity.addresses: a customer's saved delivery addresses. Owned by the identity service.
-- Orders snapshot the address they were placed with, so editing or deleting one never changes a
-- past order. Deleting is soft, so support can still see what a customer had.

create table identity.addresses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references identity.users (id),
  kind          text not null default 'other' check (kind in ('home', 'work', 'other')),
  -- Name shown for an "other" address, for example "Parents"; empty for home and work
  label         text not null default '' check (length(label) <= 30),
  line1         text not null check (length(trim(line1)) between 3 and 200),
  line2         text not null default '' check (length(line2) <= 150),
  landmark      text not null default '' check (length(landmark) <= 150),
  instructions  text not null default '' check (length(instructions) <= 200),
  lat           double precision not null check (lat between -90 and 90),
  lng           double precision not null check (lng between -180 and 180),
  pincode       text check (pincode is null or pincode ~ '^[1-9][0-9]{5}$'),
  -- The service area preset the customer picked, when there is one
  area_id       text,
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index addresses_user_idx on identity.addresses (user_id, created_at) where deleted_at is null;
-- At most one default address per customer
create unique index addresses_one_default on identity.addresses (user_id)
  where is_default and deleted_at is null;

create trigger addresses_updated_at before update on identity.addresses
  for each row execute function public.set_updated_at();
