-- Ordely - base administrativa auditable y registros contables.
-- Esta migración es aditiva: no elimina tablas, columnas ni datos existentes.

begin;

-- Catálogo persistente. Los precios dejan de depender del estado temporal del navegador.
create table if not exists public.catalogo_planes (
  plan text primary key check (plan in ('basico', 'premium', 'pro')),
  nombre text not null,
  precio_mxn numeric(10,2) not null default 0 check (precio_mxn >= 0),
  duracion_dias integer check (duracion_dias is null or duracion_dias > 0),
  activo boolean not null default true,
  actualizado_por uuid references auth.users(id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

insert into public.catalogo_planes (plan, nombre, precio_mxn, duracion_dias)
values
  ('basico', 'Básico', 0, null),
  ('premium', 'Premium', 59.99, 30),
  ('pro', 'Pro', 99.99, 30)
on conflict (plan) do nothing;

alter table public.catalogo_planes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'catalogo_planes'
      and policyname = 'catalogo_planes_lectura_autenticada'
  ) then
    create policy catalogo_planes_lectura_autenticada
      on public.catalogo_planes for select to authenticated
      using (true);
  end if;
end;
$$;

-- Bitácora inmutable desde el cliente. Solo las funciones/triggers del servidor insertan.
create table if not exists public.admin_auditoria (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  accion text not null,
  entidad text not null,
  entidad_id text,
  usuario_afectado_id uuid references auth.users(id) on delete set null,
  detalles jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now()
);

create index if not exists idx_admin_auditoria_creado_en
  on public.admin_auditoria (creado_en desc);
create index if not exists idx_admin_auditoria_usuario
  on public.admin_auditoria (usuario_afectado_id, creado_en desc);

alter table public.admin_auditoria enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_auditoria'
      and policyname = 'admin_auditoria_lectura_admin'
  ) then
    create policy admin_auditoria_lectura_admin
      on public.admin_auditoria for select to authenticated
      using (public.es_admin_actual());
  end if;
end;
$$;

-- Datos contables que faltaban en suscripciones/pagos administrativos.
alter table public.suscripciones
  add column if not exists folio_pago text,
  add column if not exists pagado_en timestamptz,
  add column if not exists referencia_pago text,
  add column if not exists comision numeric(10,2) not null default 0,
  add column if not exists reembolsado_en timestamptz,
  add column if not exists motivo_reembolso text,
  add column if not exists actualizado_por uuid references auth.users(id);

update public.suscripciones
set folio_pago = 'PAG-' || upper(substr(replace(id::text, '-', ''), 1, 10))
where folio_pago is null;

update public.suscripciones
set pagado_en = creado_en
where estado_pago = 'pagado' and pagado_en is null;

create unique index if not exists idx_suscripciones_folio_pago
  on public.suscripciones (folio_pago)
  where folio_pago is not null;
create index if not exists idx_suscripciones_pagado_en
  on public.suscripciones (pagado_en desc);

-- Seguimiento real de soporte: responsable y respuestas registradas.
alter table public.comentarios_soporte
  add column if not exists asignado_a uuid references auth.users(id),
  add column if not exists primera_respuesta_en timestamptz;

create table if not exists public.soporte_respuestas (
  id uuid primary key default gen_random_uuid(),
  comentario_id uuid not null references public.comentarios_soporte(id) on delete cascade,
  autor_id uuid references auth.users(id) on delete set null,
  mensaje text not null check (char_length(btrim(mensaje)) between 2 and 4000),
  canal text not null default 'interno' check (canal in ('interno', 'correo', 'telefono', 'whatsapp')),
  creado_en timestamptz not null default now()
);

create index if not exists idx_soporte_respuestas_comentario
  on public.soporte_respuestas (comentario_id, creado_en);

alter table public.soporte_respuestas enable row level security;

create table if not exists public.admin_alertas_gestion (
  alerta_clave text primary key,
  estado text not null default 'abierta' check (estado in ('abierta', 'atendida')),
  asignado_a uuid references auth.users(id) on delete set null,
  notas text,
  atendida_en timestamptz,
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);

alter table public.admin_alertas_gestion enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'soporte_respuestas'
      and policyname = 'soporte_respuestas_admin_select'
  ) then
    create policy soporte_respuestas_admin_select
      on public.soporte_respuestas for select to authenticated
      using (public.es_admin_actual());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_alertas_gestion'
      and policyname = 'admin_alertas_gestion_select'
  ) then
    create policy admin_alertas_gestion_select
      on public.admin_alertas_gestion for select to authenticated
      using (public.es_admin_actual());
  end if;
end;
$$;

-- Auditoría automática de acciones administrativas relevantes.
create or replace function public.ordely_auditar_cambio_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_entidad_id text;
  v_usuario uuid;
  v_accion text;
  v_detalles jsonb := '{}'::jsonb;
begin
  if v_actor is null or not public.es_admin_actual() then
    return new;
  end if;

  if tg_table_name = 'perfiles' then
    v_entidad_id := coalesce(new.user_id, old.user_id)::text;
    v_usuario := coalesce(new.user_id, old.user_id);
    v_accion := 'usuario_actualizado';
    v_detalles := jsonb_build_object(
      'plan_anterior', old.plan_actual,
      'plan_nuevo', new.plan_actual,
      'vence_antes', old.plan_expira_en,
      'vence_despues', new.plan_expira_en,
      'bloqueada_antes', old.cuenta_bloqueada,
      'bloqueada_despues', new.cuenta_bloqueada,
      'nota_modificada', old.nota_admin is distinct from new.nota_admin
    );
  elsif tg_table_name = 'suscripciones' then
    v_entidad_id := new.id::text;
    v_usuario := new.user_id;
    v_accion := case when tg_op = 'INSERT' then 'pago_registrado' else 'pago_actualizado' end;
    v_detalles := jsonb_build_object(
      'folio', new.folio_pago,
      'plan', new.plan,
      'estado_anterior', case when tg_op = 'UPDATE' then old.estado_pago else null end,
      'estado_nuevo', new.estado_pago,
      'monto', new.monto
    );
  elsif tg_table_name = 'codigos_promocionales' then
    v_entidad_id := new.id::text;
    v_accion := case when tg_op = 'INSERT' then 'codigo_creado' else 'codigo_actualizado' end;
    v_detalles := jsonb_build_object(
      'codigo', new.codigo,
      'activo', new.activo,
      'usos_maximos', new.usos_maximos
    );
  elsif tg_table_name = 'comentarios_soporte' then
    v_entidad_id := coalesce(new.id, old.id)::text;
    v_usuario := coalesce(new.user_id, old.user_id);
    v_accion := 'soporte_actualizado';
    v_detalles := jsonb_build_object(
      'estado_anterior', old.estado,
      'estado_nuevo', new.estado,
      'prioridad', new.prioridad,
      'asignado_a', new.asignado_a
    );
  elsif tg_table_name = 'catalogo_planes' then
    v_entidad_id := coalesce(new.plan, old.plan);
    v_accion := 'catalogo_plan_actualizado';
    v_detalles := jsonb_build_object(
      'precio_anterior', old.precio_mxn,
      'precio_nuevo', new.precio_mxn,
      'activo', new.activo
    );
  end if;

  insert into public.admin_auditoria (
    actor_id, accion, entidad, entidad_id, usuario_afectado_id, detalles
  ) values (
    v_actor, v_accion, tg_table_name, v_entidad_id, v_usuario, v_detalles
  );

  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'ordely_auditar_perfiles_admin') then
    create trigger ordely_auditar_perfiles_admin
      after update of plan_actual, plan_expira_en, cuenta_bloqueada, nota_admin, estado_suscripcion
      on public.perfiles for each row execute function public.ordely_auditar_cambio_admin();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'ordely_auditar_suscripciones_admin') then
    create trigger ordely_auditar_suscripciones_admin
      after insert or update on public.suscripciones
      for each row execute function public.ordely_auditar_cambio_admin();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'ordely_auditar_codigos_admin') then
    create trigger ordely_auditar_codigos_admin
      after insert or update of activo, usos_maximos, codigo_expira_en, notas
      on public.codigos_promocionales for each row execute function public.ordely_auditar_cambio_admin();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'ordely_auditar_soporte_admin') then
    create trigger ordely_auditar_soporte_admin
      after update of estado, prioridad, notas_admin, asignado_a
      on public.comentarios_soporte for each row execute function public.ordely_auditar_cambio_admin();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'ordely_auditar_catalogo_admin') then
    create trigger ordely_auditar_catalogo_admin
      after update on public.catalogo_planes
      for each row execute function public.ordely_auditar_cambio_admin();
  end if;
end;
$$;

-- Resumen de usuarios con acceso, actividad y notas administrativas reales.
create or replace function public.admin_usuarios_resumen_v2()
returns table (
  user_id uuid,
  nombre text,
  correo text,
  plan_actual text,
  plan_origen text,
  plan_expira_en timestamptz,
  limite_pedidos integer,
  es_admin boolean,
  cuenta_bloqueada boolean,
  plataforma_predeterminada text,
  creado_en timestamptz,
  pedidos_usados bigint,
  limite_alcanzado boolean,
  puede_modificar boolean,
  plan_vencido boolean,
  estado_suscripcion text,
  periodo_inicia_en timestamptz,
  suscripcion_cancelada_en timestamptz,
  nota_admin text,
  ultimo_acceso_en timestamptz,
  ultima_actividad_en timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.user_id,
    p.nombre,
    p.correo,
    case when p.plan_expira_en is not null and p.plan_expira_en < now()
      then 'basico' else coalesce(p.plan_actual, 'basico') end,
    p.plan_origen,
    p.plan_expira_en,
    p.limite_pedidos,
    p.es_admin,
    p.cuenta_bloqueada,
    p.plataforma_predeterminada,
    p.creado_en,
    coalesce(pi.intentos, 0)::bigint,
    (
      case when p.plan_expira_en is not null and p.plan_expira_en < now()
        then 'basico' else coalesce(p.plan_actual, 'basico') end = 'basico'
      and coalesce(pi.intentos, 0) >= coalesce(p.limite_pedidos, 30)
    ),
    (
      not coalesce(p.cuenta_bloqueada, false)
      and (
        coalesce(p.es_admin, false)
        or case when p.plan_expira_en is not null and p.plan_expira_en < now()
          then 'basico' else coalesce(p.plan_actual, 'basico') end in ('premium', 'pro')
        or coalesce(pi.intentos, 0) < coalesce(p.limite_pedidos, 30)
      )
    ),
    p.plan_expira_en is not null and p.plan_expira_en < now(),
    p.estado_suscripcion,
    p.periodo_inicia_en,
    p.suscripcion_cancelada_en,
    p.nota_admin,
    au.last_sign_in_at,
    greatest(au.last_sign_in_at, p.actualizado_en, actividad.ultima_actividad_en)
  from public.perfiles p
  left join auth.users au on au.id = p.user_id
  left join (
    select user_id, count(*)::bigint as intentos
    from public.pedidos_intentos
    group by user_id
  ) pi on pi.user_id = p.user_id
  left join lateral (
    select max(fecha) as ultima_actividad_en
    from (
      select max(pe.creado_en) as fecha from public.pedidos pe where pe.user_id = p.user_id
      union all
      select max(pa.creado_en) as fecha from public.pagos pa where pa.user_id = p.user_id
      union all
      select max(cs.creado_en) as fecha from public.comentarios_soporte cs where cs.user_id = p.user_id
    ) fechas
  ) actividad on true
  where public.es_admin_actual()
  order by p.creado_en desc;
$$;

create or replace function public.admin_listar_suscripciones_v2()
returns table (
  id uuid,
  user_id uuid,
  nombre text,
  correo text,
  plan text,
  monto numeric,
  moneda text,
  metodo_pago text,
  estado_pago text,
  fecha_inicio timestamptz,
  fecha_fin timestamptz,
  origen text,
  notas text,
  creado_en timestamptz,
  creado_por_correo text,
  folio_pago text,
  pagado_en timestamptz,
  referencia_pago text,
  comision numeric,
  monto_neto numeric,
  reembolsado_en timestamptz,
  motivo_reembolso text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_admin_actual() then raise exception 'No autorizado'; end if;

  return query
  select
    s.id, s.user_id, p.nombre, p.correo, s.plan, s.monto, s.moneda,
    s.metodo_pago, s.estado_pago, s.fecha_inicio, s.fecha_fin, s.origen,
    s.notas, s.creado_en, creador.email::text, s.folio_pago, s.pagado_en,
    s.referencia_pago, s.comision,
    greatest(s.monto - coalesce(s.comision, 0), 0)::numeric as monto_neto,
    s.reembolsado_en, s.motivo_reembolso
  from public.suscripciones s
  left join public.perfiles p on p.user_id = s.user_id
  left join auth.users creador on creador.id = s.creado_por
  order by coalesce(s.pagado_en, s.creado_en) desc;
end;
$$;

create or replace function public.admin_listar_auditoria(
  p_limite integer default 200,
  p_user_id uuid default null
)
returns table (
  id uuid,
  actor_id uuid,
  actor_correo text,
  accion text,
  entidad text,
  entidad_id text,
  usuario_afectado_id uuid,
  usuario_afectado_correo text,
  detalles jsonb,
  creado_en timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_admin_actual() then raise exception 'No autorizado'; end if;

  return query
  select a.id, a.actor_id, actor.email::text, a.accion, a.entidad, a.entidad_id,
    a.usuario_afectado_id, afectado.email::text, a.detalles, a.creado_en
  from public.admin_auditoria a
  left join auth.users actor on actor.id = a.actor_id
  left join auth.users afectado on afectado.id = a.usuario_afectado_id
  where p_user_id is null or a.usuario_afectado_id = p_user_id
  order by a.creado_en desc
  limit least(greatest(coalesce(p_limite, 200), 1), 1000);
end;
$$;

create or replace function public.admin_listar_canjes()
returns table (
  id uuid,
  codigo_id uuid,
  codigo text,
  user_id uuid,
  nombre text,
  correo text,
  plan_otorgado text,
  plan_expira_en timestamptz,
  canjeado_en timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_admin_actual() then raise exception 'No autorizado'; end if;

  return query
  select c.id, c.codigo_id, c.codigo, c.user_id, p.nombre, p.correo,
    c.plan_otorgado, c.plan_expira_en, c.canjeado_en
  from public.codigos_canjeados c
  left join public.perfiles p on p.user_id = c.user_id
  order by c.canjeado_en desc;
end;
$$;

create or replace function public.admin_listar_alertas_gestion()
returns table (
  alerta_clave text,
  estado text,
  asignado_a uuid,
  asignado_correo text,
  notas text,
  atendida_en timestamptz,
  actualizada_en timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_admin_actual() then raise exception 'No autorizado'; end if;

  return query
  select g.alerta_clave, g.estado, g.asignado_a, u.email::text,
    g.notas, g.atendida_en, g.actualizada_en
  from public.admin_alertas_gestion g
  left join auth.users u on u.id = g.asignado_a
  order by g.actualizada_en desc;
end;
$$;

create or replace function public.admin_gestionar_alerta(
  p_alerta_clave text,
  p_estado text,
  p_notas text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin_actual() then raise exception 'No autorizado'; end if;
  if btrim(coalesce(p_alerta_clave, '')) = '' then raise exception 'Alerta no válida'; end if;
  if p_estado not in ('abierta', 'atendida') then raise exception 'Estado no válido'; end if;

  insert into public.admin_alertas_gestion (
    alerta_clave, estado, asignado_a, notas, atendida_en
  ) values (
    btrim(p_alerta_clave), p_estado, auth.uid(),
    nullif(btrim(coalesce(p_notas, '')), ''),
    case when p_estado = 'atendida' then now() else null end
  )
  on conflict (alerta_clave) do update set
    estado = excluded.estado,
    asignado_a = auth.uid(),
    notas = coalesce(excluded.notas, public.admin_alertas_gestion.notas),
    atendida_en = case when excluded.estado = 'atendida' then now() else null end,
    actualizada_en = now();

  insert into public.admin_auditoria (actor_id, accion, entidad, entidad_id, detalles)
  values (
    auth.uid(), 'alerta_' || p_estado, 'admin_alertas_gestion', btrim(p_alerta_clave),
    jsonb_build_object('estado', p_estado)
  );
end;
$$;

create or replace function public.admin_estado_sistema()
returns table (clave text, valor bigint, estado text, detalle text, verificado_en timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_admin_actual() then raise exception 'No autorizado'; end if;

  return query
  select 'pagos_sin_perfil', count(*)::bigint,
    case when count(*) = 0 then 'correcto' else 'revisar' end,
    'Pagos cuyo usuario ya no tiene un perfil asociado.', now()
  from public.suscripciones s left join public.perfiles p on p.user_id = s.user_id
  where p.user_id is null
  union all
  select 'contadores_pedidos_desfasados', count(*)::bigint,
    case when count(*) = 0 then 'correcto' else 'revisar' end,
    'Perfiles cuyo contador no coincide con los intentos registrados.', now()
  from public.perfiles p
  where p.pedidos_usados <> (select count(*) from public.pedidos_intentos i where i.user_id = p.user_id)
  union all
  select 'suscripciones_vencidas_sin_procesar', count(*)::bigint,
    case when count(*) = 0 then 'correcto' else 'revisar' end,
    'Pagos marcados como pagados cuya vigencia ya terminó.', now()
  from public.suscripciones s
  where s.estado_pago = 'pagado' and s.fecha_fin is not null and s.fecha_fin < now()
  union all
  select 'tickets_abiertos', count(*)::bigint,
    case when count(*) = 0 then 'correcto' else 'informativo' end,
    'Solicitudes de soporte todavía abiertas.', now()
  from public.comentarios_soporte c
  where c.estado not in ('Resuelto', 'Descartado')
  union all
  select 'acciones_auditadas', count(*)::bigint, 'informativo',
    'Acciones administrativas guardadas en la bitácora.', now()
  from public.admin_auditoria;
end;
$$;

create or replace function public.admin_actualizar_catalogo_plan(
  p_plan text,
  p_precio_mxn numeric,
  p_duracion_dias integer default 30,
  p_activo boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin_actual() then raise exception 'No autorizado'; end if;
  if p_plan not in ('basico', 'premium', 'pro') then raise exception 'Plan no válido'; end if;
  if p_precio_mxn is null or p_precio_mxn < 0 then raise exception 'Precio no válido'; end if;
  if p_duracion_dias is not null and p_duracion_dias < 1 then raise exception 'Duración no válida'; end if;

  insert into public.catalogo_planes (
    plan, nombre, precio_mxn, duracion_dias, activo, actualizado_por
  ) values (
    p_plan,
    case p_plan when 'basico' then 'Básico' when 'premium' then 'Premium' else 'Pro' end,
    p_precio_mxn, p_duracion_dias, p_activo, auth.uid()
  )
  on conflict (plan) do update set
    precio_mxn = excluded.precio_mxn,
    duracion_dias = excluded.duracion_dias,
    activo = excluded.activo,
    actualizado_por = auth.uid(),
    actualizado_en = now();
end;
$$;

create or replace function public.admin_actualizar_nota_usuario(p_user_id uuid, p_nota text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin_actual() then raise exception 'No autorizado'; end if;

  update public.perfiles
  set nota_admin = nullif(btrim(coalesce(p_nota, '')), ''), actualizado_en = now()
  where user_id = p_user_id;

  if not found then raise exception 'Usuario no encontrado'; end if;
end;
$$;

-- Esta función suma desde el vencimiento actual; nunca reinicia el contador de pedidos.
create or replace function public.admin_agregar_dias_usuario(p_user_id uuid, p_dias integer)
returns table (exito boolean, mensaje text, vence_en timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base timestamptz;
  v_plan text;
  v_expira timestamptz;
begin
  if not public.es_admin_actual() then raise exception 'Acceso no autorizado'; end if;
  if p_dias is null or p_dias < 1 or p_dias > 3650 then raise exception 'Cantidad de días inválida'; end if;

  select greatest(coalesce(plan_expira_en, now()), now()), plan_actual, plan_expira_en
  into v_base, v_plan, v_expira
  from public.perfiles
  where user_id = p_user_id
  for update;

  if not found then raise exception 'Usuario no encontrado'; end if;
  if v_plan not in ('premium', 'pro') then
    raise exception 'Primero asigna Premium o Pro al usuario';
  end if;
  if v_expira is null then
    raise exception 'Este usuario ya tiene acceso sin vencimiento; agregar días lo reduciría';
  end if;

  update public.perfiles
  set plan_expira_en = v_base + make_interval(days => p_dias),
      estado_suscripcion = 'activa',
      suscripcion_cancelada_en = null,
      cuenta_bloqueada = false,
      actualizado_en = now()
  where user_id = p_user_id;

  return query select true,
    format('Se agregaron %s días sin reiniciar los pedidos usados.', p_dias),
    v_base + make_interval(days => p_dias);
end;
$$;

-- Pago manual v2: registra fecha/referencia/comisión y extiende la vigencia si es el mismo plan.
create or replace function public.admin_registrar_pago_manual_v2(
  p_user_id uuid,
  p_plan text,
  p_monto numeric,
  p_metodo_pago text,
  p_duracion_dias integer default 30,
  p_sin_vencimiento boolean default false,
  p_notas text default null,
  p_pagado_en timestamptz default now(),
  p_referencia_pago text default null,
  p_comision numeric default 0
)
returns table (
  exito boolean,
  mensaje text,
  suscripcion_id uuid,
  plan_activado text,
  vence_en timestamptz,
  folio_pago text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_suscripcion_id uuid;
  v_folio text;
  v_plan_actual text;
  v_expira_actual timestamptz;
  v_fecha_inicio timestamptz;
  v_fecha_fin timestamptz;
begin
  if not public.es_admin_actual() then raise exception 'No autorizado'; end if;
  if p_plan not in ('premium', 'pro') then raise exception 'Plan no válido'; end if;
  if p_monto is null or p_monto < 0 then raise exception 'Monto no válido'; end if;
  if coalesce(p_comision, 0) < 0 or coalesce(p_comision, 0) > p_monto then
    raise exception 'Comisión no válida';
  end if;
  if not coalesce(p_sin_vencimiento, false) and (p_duracion_dias is null or p_duracion_dias < 1) then
    raise exception 'Duración no válida';
  end if;

  select plan_actual, plan_expira_en
  into v_plan_actual, v_expira_actual
  from public.perfiles
  where user_id = p_user_id
  for update;

  if not found then raise exception 'Usuario no encontrado'; end if;

  v_fecha_inicio := coalesce(p_pagado_en, now());

  if coalesce(p_sin_vencimiento, false) then
    v_fecha_fin := null;
  elsif v_plan_actual = p_plan and v_expira_actual is not null then
    v_fecha_inicio := greatest(v_expira_actual, v_fecha_inicio);
    v_fecha_fin := v_fecha_inicio + make_interval(days => p_duracion_dias);
  elsif v_plan_actual = p_plan and v_expira_actual is null and v_plan_actual in ('premium', 'pro') then
    v_fecha_fin := null;
  else
    v_fecha_fin := v_fecha_inicio + make_interval(days => p_duracion_dias);
  end if;

  v_folio := 'PAG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  insert into public.suscripciones (
    user_id, plan, monto, moneda, metodo_pago, estado_pago, fecha_inicio,
    fecha_fin, origen, notas, creado_por, folio_pago, pagado_en,
    referencia_pago, comision, actualizado_por
  ) values (
    p_user_id, p_plan, p_monto, 'MXN',
    coalesce(nullif(btrim(p_metodo_pago), ''), 'manual'), 'pagado',
    v_fecha_inicio, v_fecha_fin, 'manual', nullif(btrim(coalesce(p_notas, '')), ''),
    auth.uid(), v_folio, coalesce(p_pagado_en, now()),
    nullif(btrim(coalesce(p_referencia_pago, '')), ''), coalesce(p_comision, 0), auth.uid()
  ) returning id into v_suscripcion_id;

  update public.perfiles
  set plan_actual = p_plan,
      plan_origen = 'pago',
      plan_expira_en = v_fecha_fin,
      limite_pedidos = 999999,
      cuenta_bloqueada = false,
      estado_suscripcion = 'activa',
      actualizado_en = now()
  where user_id = p_user_id;

  return query select true,
    case
      when v_fecha_fin is null then 'Pago registrado. El acceso continúa sin vencimiento.'
      when v_fecha_inicio > coalesce(p_pagado_en, now()) then 'Pago registrado y días agregados al vencimiento actual.'
      else 'Pago registrado y plan activado correctamente.'
    end,
    v_suscripcion_id, p_plan, v_fecha_fin, v_folio;
end;
$$;

create or replace function public.admin_actualizar_estado_suscripcion_v2(
  p_suscripcion_id uuid,
  p_estado_pago text,
  p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin_actual() then raise exception 'No autorizado'; end if;
  if p_estado_pago not in ('pendiente', 'pagado', 'cancelado', 'vencido', 'reembolsado') then
    raise exception 'Estado no válido';
  end if;

  update public.suscripciones
  set estado_pago = p_estado_pago,
      pagado_en = case when p_estado_pago = 'pagado' then coalesce(pagado_en, now()) else pagado_en end,
      reembolsado_en = case when p_estado_pago = 'reembolsado' then now() else null end,
      motivo_reembolso = case when p_estado_pago = 'reembolsado' then nullif(btrim(coalesce(p_motivo, '')), '') else null end,
      actualizado_por = auth.uid(),
      actualizado_en = now()
  where id = p_suscripcion_id;

  if not found then raise exception 'Pago no encontrado'; end if;
end;
$$;

create or replace function public.admin_registrar_respuesta_soporte(
  p_comentario_id uuid,
  p_mensaje text,
  p_canal text default 'interno'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.es_admin_actual() then raise exception 'No autorizado'; end if;
  if char_length(btrim(coalesce(p_mensaje, ''))) < 2 then raise exception 'Respuesta vacía'; end if;
  if p_canal not in ('interno', 'correo', 'telefono', 'whatsapp') then raise exception 'Canal no válido'; end if;

  insert into public.soporte_respuestas (comentario_id, autor_id, mensaje, canal)
  values (p_comentario_id, auth.uid(), btrim(p_mensaje), p_canal)
  returning id into v_id;

  update public.comentarios_soporte
  set estado = case when estado in ('Nuevo', 'En revisión') then 'Respondido' else estado end,
      primera_respuesta_en = coalesce(primera_respuesta_en, now()),
      asignado_a = coalesce(asignado_a, auth.uid()),
      actualizado_en = now()
  where id = p_comentario_id;

  if not found then raise exception 'Comentario no encontrado'; end if;
  return v_id;
end;
$$;

grant select on public.catalogo_planes to authenticated;
grant select on public.admin_auditoria to authenticated;
grant select on public.soporte_respuestas to authenticated;
grant select on public.admin_alertas_gestion to authenticated;

grant execute on function public.admin_usuarios_resumen_v2() to authenticated;
grant execute on function public.admin_listar_suscripciones_v2() to authenticated;
grant execute on function public.admin_listar_auditoria(integer, uuid) to authenticated;
grant execute on function public.admin_listar_canjes() to authenticated;
grant execute on function public.admin_listar_alertas_gestion() to authenticated;
grant execute on function public.admin_gestionar_alerta(text, text, text) to authenticated;
grant execute on function public.admin_estado_sistema() to authenticated;
grant execute on function public.admin_actualizar_catalogo_plan(text, numeric, integer, boolean) to authenticated;
grant execute on function public.admin_actualizar_nota_usuario(uuid, text) to authenticated;
grant execute on function public.admin_agregar_dias_usuario(uuid, integer) to authenticated;
grant execute on function public.admin_registrar_pago_manual_v2(uuid, text, numeric, text, integer, boolean, text, timestamptz, text, numeric) to authenticated;
grant execute on function public.admin_actualizar_estado_suscripcion_v2(uuid, text, text) to authenticated;
grant execute on function public.admin_registrar_respuesta_soporte(uuid, text, text) to authenticated;

revoke all on public.admin_auditoria from anon;
revoke all on public.soporte_respuestas from anon;
revoke all on public.admin_alertas_gestion from anon;
revoke all on function public.ordely_auditar_cambio_admin() from public, anon, authenticated;

commit;
