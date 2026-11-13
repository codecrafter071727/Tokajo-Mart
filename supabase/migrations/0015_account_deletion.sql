-- Account deletion (App Store and Play Store both require it inside the app).
-- A deleted customer's row stays so past orders still point at a user id, but everything that
-- identifies them is removed: name, phone, email, password, addresses and sessions. The phone
-- becomes free, so the same number can sign up again as a brand new account.
--
-- -- allow-destructive: the status and login checks are dropped and recreated to allow 'deleted';
-- no data is removed by this migration.

alter table identity.users drop constraint if exists users_status_check;
alter table identity.users add constraint users_status_check
  check (status in ('active', 'blocked', 'pending', 'deleted'));

-- A deleted account has no way to sign in, by design
alter table identity.users drop constraint if exists users_has_login;
alter table identity.users add constraint users_has_login check (
  status = 'deleted' or phone is not null or (email is not null and password_hash is not null)
);

alter table identity.users add column if not exists deleted_at timestamptz;
alter table identity.users add column if not exists deletion_reason text
  check (deletion_reason is null or length(deletion_reason) <= 300);

alter table identity.users add constraint users_deleted_has_time
  check (status <> 'deleted' or deleted_at is not null);
