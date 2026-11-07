-- =====================================================================
-- Cubothèque : base en ligne Supabase
-- À coller dans Supabase > SQL Editor > New query, puis « Run ».
-- Le script peut être relancé sans risque.
-- Principe : tout le monde peut LIRE la collection, seuls les comptes
-- listés dans la table admins peuvent ÉCRIRE (règles RLS).
-- =====================================================================

-- Comptes autorisés à modifier
create table if not exists public.admins (
  user_id uuid primary key references auth.users on delete cascade,
  created_at timestamptz default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;

-- Données (le détail de chaque fiche est stocké en JSON pour rester souple)
create table if not exists public.items  (id text primary key, num int, data jsonb not null, updated_at timestamptz default now());
create table if not exists public.sheets (id text primary key, data jsonb not null, updated_at timestamptz default now());
create table if not exists public.solves (id text primary key, data jsonb not null, created_at timestamptz default now());
create table if not exists public.site   (id text primary key, data jsonb not null, updated_at timestamptz default now());

alter table public.admins enable row level security;
alter table public.items  enable row level security;
alter table public.sheets enable row level security;
alter table public.solves enable row level security;
alter table public.site   enable row level security;

-- admins : chacun peut seulement vérifier s'il en fait partie
drop policy if exists "admins: soi-même" on public.admins;
create policy "admins: soi-même" on public.admins for select to authenticated using (user_id = auth.uid());

-- lecture publique, écriture réservée aux admins
do $$
declare t text;
begin
  foreach t in array array['items', 'sheets', 'solves', 'site'] loop
    execute format('drop policy if exists "lecture publique" on public.%I', t);
    execute format('create policy "lecture publique" on public.%I for select using (true)', t);
    execute format('drop policy if exists "écriture admin" on public.%I', t);
    execute format('create policy "écriture admin" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- Images : un espace de stockage public en lecture
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do update set public = true;

drop policy if exists "images: lecture" on storage.objects;
create policy "images: lecture" on storage.objects for select using (bucket_id = 'images');
drop policy if exists "images: ajout admin" on storage.objects;
create policy "images: ajout admin" on storage.objects for insert to authenticated with check (bucket_id = 'images' and public.is_admin());
drop policy if exists "images: modif admin" on storage.objects;
create policy "images: modif admin" on storage.objects for update to authenticated using (bucket_id = 'images' and public.is_admin());
drop policy if exists "images: suppression admin" on storage.objects;
create policy "images: suppression admin" on storage.objects for delete to authenticated using (bucket_id = 'images' and public.is_admin());

-- =====================================================================
-- APRÈS avoir créé votre compte (Authentication > Users > Add user),
-- remplacez l'adresse ci-dessous et lancez cette ligne :
--
-- insert into public.admins (user_id) select id from auth.users where email = 'vous@exemple.fr';
-- =====================================================================
