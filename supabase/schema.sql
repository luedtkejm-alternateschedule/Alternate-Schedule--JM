create extension if not exists pgcrypto;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  role text not null check (role in ('TEACHER','STUDENT','ADMIN','TEACHER_ADMIN')),
  first_name text not null,
  last_name text not null,
  duty text,
  schedule_number int not null default 1,
  special_periods text,
  created_at timestamptz not null default now()
);

create table if not exists common_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  max_students int not null default 0,
  period_number int not null check (period_number between 1 and 8),
  sort_order int not null default 1,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists common_areas_name_period_unique on common_areas(name, period_number);

create table if not exists teacher_sessions (
  id uuid primary key default gen_random_uuid(),
  teacher_user_id uuid not null references app_users(id) on delete cascade,
  period_number int not null check (period_number between 1 and 8),
  week_key text not null,
  session_type text not null check (session_type in ('OFFICE_HOURS','ENRICHMENT')),
  title text not null,
  description text,
  room_number text,
  max_students int not null default 0,
  overflow boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (teacher_user_id, period_number, week_key)
);

create table if not exists student_choices (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references app_users(id) on delete cascade,
  period_number int not null check (period_number between 1 and 8),
  choice_type text not null check (choice_type in ('COMMON_AREA','TEACHER_SESSION')),
  choice_ref text not null,
  choice_label text not null,
  changed_by_user_id uuid references app_users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique(student_user_id, period_number)
);

create table if not exists system_settings (
  id uuid primary key default gen_random_uuid(),
  student_lock_datetime timestamptz,
  teacher_lock_datetime timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists student_schedule_status (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references app_users(id) on delete cascade,
  schedule_date date not null,
  is_saved boolean not null default false,
  saved_at timestamptz,
  unique(student_user_id, schedule_date)
);

insert into common_areas (name, description, max_students, period_number, sort_order, is_enabled)
select area_name, area_desc, area_max, p.period_number, area_sort, enabled
from (
  values
    ('Gym', 'Default common area', 150, 1, true),
    ('Cafeteria', 'Default common area', 225, 2, true),
    ('Library', 'Default common area', 150, 3, true),
    ('Auditorium', 'Default common area', 225, 4, true),
    ('Rocket Center', 'Default common area', 75, 5, true)
) as seed(area_name, area_desc, area_max, area_sort, enabled)
cross join lateral (
  select * from (values (1),(2),(3),(4),(5),(6),(7),(8)) as periods(period_number)
) p
where
  (seed.area_name = 'Cafeteria' and p.period_number in (1,2))
  or (seed.area_name <> 'Cafeteria')
on conflict (name, period_number) do nothing;

update common_areas set sort_order =
  case name
    when 'Gym' then 1
    when 'Cafeteria' then 2
    when 'Library' then 3
    when 'Auditorium' then 4
    when 'Rocket Center' then 5
    else sort_order
  end;

insert into system_settings (student_lock_datetime, teacher_lock_datetime)
select null, null
where not exists (select 1 from system_settings);

insert into app_users (email, password_hash, role, first_name, last_name, duty, schedule_number, special_periods)
values (
  'admin@demo.local',
  '$2b$10$aw1/t5FCmTbSTIdc7B1rl.vTPLqD7Obh5jrDQkFggAmMIIOvcSvSy',
  'ADMIN',
  'Demo',
  'Admin',
  null,
  1,
  null
)
on conflict (email) do update
set password_hash = excluded.password_hash,
    role = excluded.role,
    first_name = excluded.first_name,
    last_name = excluded.last_name;
