-- Notificaciones internas de Ordely enviadas desde un comentario de soporte.
-- Los usuarios solo pueden leer y marcar sus propias notificaciones. La
-- creación queda limitada a una función administrativa validada en servidor.

begin;

create table if not exists public.notificaciones_usuario (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  comentario_id uuid references public.comentarios_soporte(id) on delete set null,
  tipo text not null default 'soporte' check (tipo in ('soporte', 'sistema')),
  titulo text not null check (char_length(btrim(titulo)) between 2 and 120),
  mensaje text not null check (char_length(btrim(mensaje)) between 2 and 1500),
  creada_por uuid references auth.users(id) on delete set null,
  leida_en timestamptz,
  creado_en timestamptz not null default now()
);

create index if not exists idx_notificaciones_usuario_pendientes
  on public.notificaciones_usuario (user_id, creado_en desc)
  where leida_en is null;

alter table public.notificaciones_usuario enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notificaciones_usuario'
      and policyname = 'notificaciones_propias_lectura'
  ) then
    create policy notificaciones_propias_lectura
      on public.notificaciones_usuario
      for select to authenticated
      using (user_id = auth.uid());
  end if;
end;
$$;

create or replace function public.admin_enviar_notificacion_soporte_v1(
  p_comentario_id uuid,
  p_mensaje text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_asunto text;
  v_mensaje text := btrim(coalesce(p_mensaje, ''));
  v_notificacion_id uuid;
begin
  if not public.es_admin_actual() then
    raise exception 'Acceso no autorizado';
  end if;

  if char_length(v_mensaje) < 2 or char_length(v_mensaje) > 1500 then
    raise exception 'El mensaje debe contener entre 2 y 1500 caracteres';
  end if;

  select c.user_id, c.asunto
  into v_user_id, v_asunto
  from public.comentarios_soporte c
  where c.id = p_comentario_id;

  if not found then raise exception 'Comentario no encontrado'; end if;
  if v_user_id is null then raise exception 'El comentario no pertenece a una cuenta registrada'; end if;

  insert into public.notificaciones_usuario (
    user_id, comentario_id, tipo, titulo, mensaje, creada_por
  ) values (
    v_user_id,
    p_comentario_id,
    'soporte',
    left('Soporte: ' || coalesce(nullif(btrim(v_asunto), ''), 'Mensaje de Ordely'), 120),
    v_mensaje,
    auth.uid()
  ) returning id into v_notificacion_id;

  insert into public.admin_auditoria (
    actor_id, accion, entidad, entidad_id, usuario_afectado_id, detalles
  ) values (
    auth.uid(),
    'notificacion_soporte_enviada',
    'notificaciones_usuario',
    v_notificacion_id::text,
    v_user_id,
    jsonb_build_object('comentario_id', p_comentario_id)
  );

  return v_notificacion_id;
end;
$$;

create or replace function public.marcar_mi_notificacion_leida_v1(p_notificacion_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;

  update public.notificaciones_usuario
  set leida_en = coalesce(leida_en, now())
  where id = p_notificacion_id
    and user_id = auth.uid();

  if not found then raise exception 'Notificación no encontrada'; end if;
end;
$$;

create or replace function public.marcar_mis_notificaciones_leidas_v1()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actualizadas integer;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;

  update public.notificaciones_usuario
  set leida_en = now()
  where user_id = auth.uid()
    and leida_en is null;

  get diagnostics v_actualizadas = row_count;
  return v_actualizadas;
end;
$$;

revoke all on public.notificaciones_usuario from anon, authenticated;
grant select on public.notificaciones_usuario to authenticated;

revoke all on function public.admin_enviar_notificacion_soporte_v1(uuid, text) from public, anon;
revoke all on function public.marcar_mi_notificacion_leida_v1(uuid) from public, anon;
revoke all on function public.marcar_mis_notificaciones_leidas_v1() from public, anon;

grant execute on function public.admin_enviar_notificacion_soporte_v1(uuid, text) to authenticated;
grant execute on function public.marcar_mi_notificacion_leida_v1(uuid) to authenticated;
grant execute on function public.marcar_mis_notificaciones_leidas_v1() to authenticated;

commit;
