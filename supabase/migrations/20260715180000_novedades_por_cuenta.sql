-- Guarda por cuenta la última versión de las novedades que el usuario cerró.
-- Es independiente de la guía inicial: una aparece por actualización y la otra
-- solamente explica el flujo de Ordely a cuentas nuevas.

begin;

alter table public.perfiles
  add column if not exists novedades_version_vista text,
  add column if not exists novedades_vista_en timestamptz;

comment on column public.perfiles.novedades_version_vista is
  'Última versión de las novedades cerrada por la cuenta.';

comment on column public.perfiles.novedades_vista_en is
  'Fecha en que la cuenta cerró el aviso de novedades de la versión guardada.';

create or replace function public.mi_estado_novedades_v1()
returns table (
  version_vista text,
  vista_en timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p.novedades_version_vista,
    p.novedades_vista_en
  from public.perfiles p
  where p.user_id = auth.uid();
$$;

create or replace function public.marcar_mis_novedades_vistas_v1(p_version text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_version text := btrim(coalesce(p_version, ''));
begin
  if v_user_id is null then
    raise exception 'Debes iniciar sesión para guardar las novedades.';
  end if;

  if char_length(v_version) < 3
    or char_length(v_version) > 32
    or v_version !~ '^[0-9][0-9a-zA-Z.+-]*$' then
    raise exception 'La versión de las novedades no es válida.';
  end if;

  update public.perfiles
  set novedades_version_vista = v_version,
      novedades_vista_en = now(),
      actualizado_en = now()
  where user_id = v_user_id;

  if not found then
    raise exception 'No se encontró el perfil de la cuenta.';
  end if;
end;
$$;

revoke all on function public.mi_estado_novedades_v1() from public, anon;
revoke all on function public.marcar_mis_novedades_vistas_v1(text) from public, anon;

grant execute on function public.mi_estado_novedades_v1() to authenticated;
grant execute on function public.marcar_mis_novedades_vistas_v1(text) to authenticated;

commit;
