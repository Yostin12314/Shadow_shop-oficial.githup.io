-- SHADOW SHOP · Etapa 2
-- Ejecuta TODO este archivo en Supabase > SQL Editor > New query.
-- Roles disponibles: customer (predeterminado) y admin (solo asignación manual confiable).

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Jugador' check (char_length(display_name) between 2 and 60),
  phone text null check (phone is null or char_length(phone) <= 30),
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Crea el perfil automáticamente al registrarse un usuario en Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text;
begin
  requested_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  if requested_name is null or char_length(requested_name) < 2 then
    requested_name := 'Jugador';
  end if;
  insert into public.profiles (id, display_name)
  values (new.id, left(requested_name, 60));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Función protegida para comprobar el rol. No acepta un user_id del navegador.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  );
$$;

alter table public.profiles enable row level security;

-- Privilegios mínimos: los clientes no pueden insertar perfiles ni cambiar su rol.
revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name, phone) on table public.profiles to authenticated;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id or (select public.is_admin()));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- No se crea una política INSERT/DELETE para clientes.
-- El trigger de registro escribe mediante su función SECURITY DEFINER.
-- La asignación de administradores se hace desde el SQL Editor por el propietario del proyecto.

-- Para promover un usuario a administrador, después de que se registre:
-- update public.profiles
-- set role = 'admin'
-- where id = (select id from auth.users where email = 'TU_CORREO_DE_ADMIN');
--
-- Para revisar los perfiles:
-- select p.id, u.email, p.display_name, p.role, p.created_at
-- from public.profiles p join auth.users u on u.id = p.id
-- order by p.created_at desc;
