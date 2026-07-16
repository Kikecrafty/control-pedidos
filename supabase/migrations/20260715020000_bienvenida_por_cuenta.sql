begin;

alter table public.perfiles
  add column if not exists bienvenida_flujo_id text,
  add column if not exists bienvenida_vista_en timestamptz;

comment on column public.perfiles.bienvenida_flujo_id is
  'Identificador de la última versión de la bienvenida completada por la cuenta.';

comment on column public.perfiles.bienvenida_vista_en is
  'Fecha en que la cuenta completó la versión guardada de la bienvenida.';

create or replace function public.mi_estado_bienvenida_v1()
returns table (
  flujo_id text,
  vista_en timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p.bienvenida_flujo_id,
    p.bienvenida_vista_en
  from public.perfiles p
  where p.user_id = auth.uid();
$$;

create or replace function public.marcar_mi_bienvenida_vista_v1(p_flujo_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_flujo_id text := btrim(coalesce(p_flujo_id, ''));
begin
  if v_user_id is null then
    raise exception 'Debes iniciar sesión para guardar la bienvenida.';
  end if;

  if char_length(v_flujo_id) < 3
    or char_length(v_flujo_id) > 80
    or v_flujo_id !~ '^[a-z0-9][a-z0-9-]+[a-z0-9]$' then
    raise exception 'El identificador de la bienvenida no es válido.';
  end if;

  update public.perfiles
  set bienvenida_flujo_id = v_flujo_id,
      bienvenida_vista_en = now(),
      actualizado_en = now()
  where user_id = v_user_id;

  if not found then
    raise exception 'No se encontró el perfil de la cuenta.';
  end if;
end;
$$;

revoke all on function public.mi_estado_bienvenida_v1() from public, anon;
revoke all on function public.marcar_mi_bienvenida_vista_v1(text) from public, anon;

grant execute on function public.mi_estado_bienvenida_v1() to authenticated;
grant execute on function public.marcar_mi_bienvenida_vista_v1(text) to authenticated;

commit;
