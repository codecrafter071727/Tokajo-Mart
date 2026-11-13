-- delivery: where a rider is right now, and the photo taken at the door.
-- Only the latest position is kept (one row per rider, overwritten), so the table never grows.

create table delivery.rider_locations (
  rider_id     uuid primary key,
  lat          double precision not null check (lat between -90 and 90),
  lng          double precision not null check (lng between -180 and 180),
  accuracy_m   double precision check (accuracy_m is null or accuracy_m >= 0),
  heading      double precision check (heading is null or (heading >= 0 and heading < 360)),
  speed        double precision check (speed is null or speed >= 0),
  -- When the phone took the reading, which can be a little before it reached us
  recorded_at  timestamptz not null,
  updated_at   timestamptz not null default now()
);

-- Proof of delivery photo. The file lives in storage; only its key is kept here.
alter table delivery.deliveries
  add column pod_key text,
  add column pod_bytes integer check (pod_bytes is null or pod_bytes > 0),
  add column pod_uploaded_at timestamptz;
