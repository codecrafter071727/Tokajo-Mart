-- identity: who is calling. Owned by the identity service.
-- Customers and riders sign in with a phone code; staff and admins with email and password.
-- Riders and staff are created by an admin: there is no self sign up for those roles.

create schema if not exists identity;

create table identity.users (
  id             uuid primary key default gen_random_uuid(),
  role           text not null check (role in ('customer', 'rider', 'warehouse_staff', 'warehouse_manager', 'admin')),
  name           text not null default '',
  phone          text unique check (phone is null or phone ~ '^\+[0-9]{8,15}$'),
  email          text unique check (email is null or email = lower(email)),
  password_hash  text,
  warehouse_id   text,
  status         text not null default 'active' check (status in ('active', 'blocked', 'pending')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Every account needs some way to sign in
  constraint users_has_login check (phone is not null or (email is not null and password_hash is not null)),
  -- Warehouse staff must belong to a warehouse
  constraint users_staff_has_warehouse check (
    role not in ('warehouse_staff', 'warehouse_manager') or warehouse_id is not null
  )
);

create table identity.rider_profiles (
  user_id       uuid primary key references identity.users (id),
  vehicle       text not null default '',
  rating        numeric(3, 2) not null default 5.00 check (rating between 0 and 5),
  warehouse_id  text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- A sign in attempt. The code is stored hashed, expires quickly and allows few guesses.
create table identity.otp_challenges (
  id           uuid primary key default gen_random_uuid(),
  phone        text not null,
  code_hash    text not null,
  expires_at   timestamptz not null,
  attempts     integer not null default 0,
  consumed_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index otp_challenges_phone_idx on identity.otp_challenges (phone, created_at desc);

create table identity.refresh_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references identity.users (id),
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);

create trigger users_updated_at before update on identity.users
  for each row execute function public.set_updated_at();
create trigger rider_profiles_updated_at before update on identity.rider_profiles
  for each row execute function public.set_updated_at();
