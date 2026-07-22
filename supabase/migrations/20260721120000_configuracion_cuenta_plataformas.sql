-- Configuracion de cuenta persistente por usuario.
-- Guarda punto de entrega, plataformas activas y tiempos por plataforma en perfiles.

alter table public.perfiles
  add column if not exists negocio_nombre text,
  add column if not exists negocio_direccion text,
  add column if not exists negocio_horario text,
  add column if not exists tiempo_shein_dias integer default 10,
  add column if not exists tiempo_temu_dias integer default 14,
  add column if not exists tiempo_aliexpress_dias integer default 25,
  add column if not exists tiempo_tiktok_shop_dias integer default 12,
  add column if not exists tiempo_mercado_libre_dias integer default 5,
  add column if not exists tiempo_amazon_dias integer default 7,
  add column if not exists tiempo_catalogo_dias integer default 7,
  add column if not exists tiempo_otro_dias integer default 15,
  add column if not exists plataformas_activas text[] default array['SHEIN', 'Temu', 'AliExpress', 'Catálogo']::text[],
  add column if not exists fecha_formato text default 'dd/mm/yyyy',
  add column if not exists fecha_mostrar_anio boolean default true,
  add column if not exists pedidos_separar_por_fecha boolean default true;

update public.perfiles
set plataformas_activas = array['SHEIN', 'Temu', 'AliExpress', 'Catálogo']::text[]
where plataformas_activas is null
   or array_length(plataformas_activas, 1) is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'perfiles_plataformas_activas_validas'
      and conrelid = 'public.perfiles'::regclass
  ) then
    alter table public.perfiles
      add constraint perfiles_plataformas_activas_validas
      check (
        plataformas_activas is null
        or plataformas_activas <@ array[
          'SHEIN',
          'Temu',
          'AliExpress',
          'TikTok Shop',
          'Mercado Libre',
          'Amazon',
          'Catálogo',
          'Otro'
        ]::text[]
      );
  end if;
end $$;

create or replace function public.obtener_dias_estimados_plataforma(
  p_user_id uuid,
  p_plataforma text
) returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_perfil public.perfiles%rowtype;
  v_plataforma text := lower(coalesce(p_plataforma, 'shein'));
begin
  if auth.uid() is not null
     and p_user_id <> auth.uid()
     and not public.es_admin_actual() then
    raise exception 'No autorizado';
  end if;

  select p.* into v_perfil
  from public.perfiles p
  where p.user_id = p_user_id;

  if not found then
    return 10;
  end if;

  if v_plataforma like '%temu%' then
    return coalesce(v_perfil.tiempo_temu_dias, 14);
  elsif v_plataforma like '%ali%' then
    return coalesce(v_perfil.tiempo_aliexpress_dias, 25);
  elsif v_plataforma like '%tiktok%' then
    return coalesce(v_perfil.tiempo_tiktok_shop_dias, 12);
  elsif v_plataforma like '%mercado%' then
    return coalesce(v_perfil.tiempo_mercado_libre_dias, 5);
  elsif v_plataforma like '%amazon%' then
    return coalesce(v_perfil.tiempo_amazon_dias, 7);
  elsif v_plataforma like '%cat%' then
    return coalesce(v_perfil.tiempo_catalogo_dias, 7);
  elsif v_plataforma like '%otro%' then
    return coalesce(v_perfil.tiempo_otro_dias, 15);
  end if;

  return coalesce(v_perfil.tiempo_shein_dias, 10);
end;
$$;

comment on column public.perfiles.plataformas_activas is
  'Plataformas habilitadas por cada cuenta para crear pedidos y configurar tiempos.';
comment on column public.perfiles.tiempo_tiktok_shop_dias is
  'Dias estimados de llegada para TikTok Shop en esta cuenta.';
comment on column public.perfiles.tiempo_mercado_libre_dias is
  'Dias estimados de llegada para Mercado Libre en esta cuenta.';
comment on column public.perfiles.tiempo_amazon_dias is
  'Dias estimados de llegada para Amazon en esta cuenta.';
