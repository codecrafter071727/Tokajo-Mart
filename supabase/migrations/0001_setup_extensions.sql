-- Cross-cutting setup: extensions and the shared updated_at trigger function.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
