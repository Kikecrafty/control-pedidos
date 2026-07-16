-- Ordely - programa de referidos, recompensas y retiros.
-- Esta migración es revisable e idempotente. No se aplica automáticamente.

begin;

create extension if not exists pgcrypto;

create table if not exists public.referidos_programas (
  user_id uuid primary key references public.perfiles(user_id) on delete cascade,
  codigo text not null unique,
  estado text not null default 'solicitado',
  solicitado_en timestamptz not null default now(),
  resuelto_en timestamptz,
  resuelto_por uuid references auth.users(id) on delete set null,
  nota_admin text,
  promotor_desbloqueado_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint referidos_programas_codigo_formato
    check (codigo ~ '^ORD-[A-Z0-9]{8,16}$'),
  constraint referidos_programas_estado_valido
    check (estado in ('solicitado', 'activo', 'rechazado'))
);

create table if not exists public.referidos (
  id uuid primary key default gen_random_uuid(),
  promotor_user_id uuid not null references public.perfiles(user_id) on delete cascade,
  invitado_user_id uuid not null unique references public.perfiles(user_id) on delete cascade,
  codigo_usado text not null,
  estado text not null default 'registrado',
  suscripcion_id uuid unique references public.suscripciones(id) on delete set null,
  plan_comprado text,
  precio_base numeric(10,2),
  porcentaje_comision numeric(5,2) not null default 0,
  comision_mxn numeric(10,2),
  registrado_en timestamptz not null default now(),
  comprado_en timestamptz,
  valida_desde timestamptz,
  aprobado_en timestamptz,
  cancelado_en timestamptz,
  aprobado_por uuid references auth.users(id) on delete set null,
  nota_admin text,
  constraint referidos_sin_autorreferido check (promotor_user_id <> invitado_user_id),
  constraint referidos_estado_valido check (
    estado in ('registrado', 'validando', 'aprobado', 'rechazado', 'cancelado', 'revision')
  ),
  constraint referidos_plan_valido check (plan_comprado is null or plan_comprado in ('premium', 'pro')),
  constraint referidos_precio_base_valido check (precio_base is null or precio_base >= 0),
  constraint referidos_comision_valida check (comision_mxn is null or comision_mxn >= 0)
);

create table if not exists public.referidos_retiros (
  id uuid primary key default gen_random_uuid(),
  promotor_user_id uuid not null references public.perfiles(user_id) on delete cascade,
  monto_mxn numeric(10,2) not null,
  estado text not null default 'solicitado',
  solicitado_en timestamptz not null default now(),
  pagado_en timestamptz,
  procesado_por uuid references auth.users(id) on delete set null,
  referencia_pago text,
  notas text,
  constraint referidos_retiros_monto_positivo check (monto_mxn > 0),
  constraint referidos_retiros_estado_valido check (estado in ('solicitado', 'pagado', 'rechazado', 'cancelado'))
);

create table if not exists public.referidos_recompensas (
  id uuid primary key default gen_random_uuid(),
  promotor_user_id uuid not null references public.perfiles(user_id) on delete cascade,
  referido_id uuid references public.referidos(id) on delete set null,
  retiro_id uuid references public.referidos_retiros(id) on delete set null,
  tipo text not null,
  estado text not null default 'disponible',
  dias_premium integer,
  monto_mxn numeric(10,2),
  numero_referido integer not null,
  concepto text not null,
  creado_en timestamptz not null default now(),
  disponible_en timestamptz not null default now(),
  canjeado_en timestamptz,
  pagado_en timestamptz,
  cancelado_en timestamptz,
  constraint referidos_recompensas_tipo_valido check (
    tipo in ('dias_premium', 'dias_pro', 'pro_ilimitado', 'comision')
  ),
  constraint referidos_recompensas_estado_valido check (
    estado in ('disponible', 'solicitado', 'canjeado', 'pagado', 'cancelado')
  ),
  constraint referidos_recompensas_numero_positivo check (numero_referido > 0),
  constraint referidos_recompensas_valor_valido check (
    (tipo in ('dias_premium', 'dias_pro') and dias_premium > 0 and monto_mxn is null)
    or (tipo = 'pro_ilimitado' and dias_premium is null and monto_mxn is null)
    or (tipo = 'comision' and monto_mxn > 0 and dias_premium is null)
  )
);

-- Conserva la migracion idempotente si se reviso una version local anterior.
alter table public.referidos_programas add column if not exists estado text not null default 'solicitado';
alter table public.referidos_programas add column if not exists solicitado_en timestamptz not null default now();
alter table public.referidos_programas add column if not exists resuelto_en timestamptz;
alter table public.referidos_programas add column if not exists resuelto_por uuid references auth.users(id) on delete set null;
alter table public.referidos_programas add column if not exists nota_admin text;
alter table public.referidos_programas drop constraint if exists referidos_programas_estado_valido;
alter table public.referidos_programas add constraint referidos_programas_estado_valido
  check (estado in ('solicitado', 'activo', 'rechazado'));
alter table public.referidos alter column porcentaje_comision set default 0;
alter table public.referidos_recompensas drop constraint if exists referidos_recompensas_tipo_valido;
alter table public.referidos_recompensas add constraint referidos_recompensas_tipo_valido
  check (tipo in ('dias_premium', 'dias_pro', 'pro_ilimitado', 'comision'));
alter table public.referidos_recompensas drop constraint if exists referidos_recompensas_valor_valido;
alter table public.referidos_recompensas add constraint referidos_recompensas_valor_valido check (
  (tipo in ('dias_premium', 'dias_pro') and dias_premium > 0 and monto_mxn is null)
  or (tipo = 'pro_ilimitado' and dias_premium is null and monto_mxn is null)
  or (tipo = 'comision' and monto_mxn > 0 and dias_premium is null)
);

create index if not exists idx_referidos_promotor_estado
  on public.referidos(promotor_user_id, estado, registrado_en desc);
create index if not exists idx_referidos_validacion
  on public.referidos(estado, valida_desde) where estado = 'validando';
create index if not exists idx_referidos_recompensas_promotor_estado
  on public.referidos_recompensas(promotor_user_id, estado, creado_en desc);
create index if not exists idx_referidos_retiros_estado
  on public.referidos_retiros(estado, solicitado_en desc);

create unique index if not exists idx_referidos_recompensa_conversion_unica
  on public.referidos_recompensas(referido_id, tipo)
  where referido_id is not null;
drop index if exists public.idx_referidos_recompensa_hito_unica;

alter table public.referidos_programas enable row level security;
alter table public.referidos enable row level security;
alter table public.referidos_recompensas enable row level security;
alter table public.referidos_retiros enable row level security;

drop policy if exists referidos_programas_propietario_lectura on public.referidos_programas;
create policy referidos_programas_propietario_lectura
  on public.referidos_programas for select to authenticated
  using ((user_id = auth.uid() and estado = 'activo') or public.es_admin_actual());

drop policy if exists referidos_propietario_lectura on public.referidos;
create policy referidos_propietario_lectura
  on public.referidos for select to authenticated
  using (promotor_user_id = auth.uid() or public.es_admin_actual());

drop policy if exists referidos_recompensas_propietario_lectura on public.referidos_recompensas;
create policy referidos_recompensas_propietario_lectura
  on public.referidos_recompensas for select to authenticated
  using (promotor_user_id = auth.uid() or public.es_admin_actual());

drop policy if exists referidos_retiros_propietario_lectura on public.referidos_retiros;
create policy referidos_retiros_propietario_lectura
  on public.referidos_retiros for select to authenticated
  using (promotor_user_id = auth.uid() or public.es_admin_actual());

create or replace function public.ordely_codigo_referido(p_user_id uuid)
returns text
language sql
immutable
strict
set search_path = public
as $$
  select 'ORD-' || upper(substr(md5(p_user_id::text || ':ordely-referidos'), 1, 16));
$$;

create or replace function public.validar_codigo_referido_v1(p_codigo text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when upper(btrim(coalesce(p_codigo, ''))) !~ '^ORD-[A-Z0-9]{8,16}$' then false
    else exists (
      select 1
      from public.referidos_programas rp
      where rp.codigo = upper(btrim(p_codigo))
        and rp.estado = 'activo'
    )
  end;
$$;

create or replace function public.referidos_asegurar_programa(p_user_id uuid)
returns public.referidos_programas
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_programa public.referidos_programas;
begin
  if p_user_id is null or not exists (select 1 from public.perfiles where user_id = p_user_id) then
    raise exception 'Usuario no válido';
  end if;

  select * into v_programa
  from public.referidos_programas
  where user_id = p_user_id and estado = 'activo';

  if not found then
    raise exception 'La cuenta todavía no tiene acceso activo al programa de referidos';
  end if;

  return v_programa;
end;
$$;

create or replace function public.solicitar_programa_referidos_v1()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_programa public.referidos_programas;
begin
  if v_user is null then raise exception 'Inicia sesión'; end if;
  if not exists (select 1 from public.perfiles where user_id = v_user) then
    raise exception 'Perfil no encontrado';
  end if;

  select * into v_programa
  from public.referidos_programas
  where user_id = v_user
  for update;

  if not found then
    insert into public.referidos_programas(user_id, codigo, estado)
    values (v_user, public.ordely_codigo_referido(v_user), 'solicitado')
    returning * into v_programa;
  elsif v_programa.estado = 'rechazado' then
    update public.referidos_programas
    set estado = 'solicitado', solicitado_en = now(), resuelto_en = null,
        resuelto_por = null, nota_admin = null, actualizado_en = now()
    where user_id = v_user
    returning * into v_programa;
  end if;

  return jsonb_build_object(
    'estado', v_programa.estado,
    'solicitado_en', v_programa.solicitado_en
  );
end;
$$;

create or replace function public.referidos_vincular_perfil_nuevo()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_codigo text;
  v_promotor uuid;
begin
  select upper(btrim(coalesce(au.raw_user_meta_data->>'codigo_referido', '')))
  into v_codigo
  from auth.users au
  where au.id = new.user_id;

  if v_codigo = '' then return new; end if;

  select rp.user_id into v_promotor
  from public.referidos_programas rp
  where upper(rp.codigo) = v_codigo
    and rp.estado = 'activo';

  if v_promotor is null or v_promotor = new.user_id then return new; end if;

  insert into public.referidos(promotor_user_id, invitado_user_id, codigo_usado)
  values (v_promotor, new.user_id, v_codigo)
  on conflict (invitado_user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists ordely_vincular_referido_al_crear_perfil on public.perfiles;
create trigger ordely_vincular_referido_al_crear_perfil
after insert on public.perfiles
for each row execute function public.referidos_vincular_perfil_nuevo();

-- Recupera invitaciones de cuentas creadas antes de aplicar esta migración.
insert into public.referidos(promotor_user_id, invitado_user_id, codigo_usado, registrado_en)
select rp.user_id, au.id, rp.codigo, coalesce(au.created_at, now())
from auth.users au
join public.perfiles invitado on invitado.user_id = au.id
join public.referidos_programas rp
  on upper(rp.codigo) = upper(btrim(coalesce(au.raw_user_meta_data->>'codigo_referido', '')))
 and rp.estado = 'activo'
where rp.user_id <> au.id
on conflict (invitado_user_id) do nothing;

create or replace function public.referidos_cancelar_recompensas_v1(
  p_referido_id uuid,
  p_motivo text default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_retiros uuid[];
  v_retiro_id uuid;
  v_total_retiro numeric(10,2);
  v_canceladas integer := 0;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  if p_referido_id is null then return 0; end if;

  select array_agg(distinct rr.retiro_id)
  into v_retiros
  from public.referidos_recompensas rr
  where rr.referido_id = p_referido_id
    and rr.estado = 'solicitado'
    and rr.retiro_id is not null;

  update public.referidos_recompensas
  set estado = 'cancelado',
      cancelado_en = now()
  where referido_id = p_referido_id
    and estado in ('disponible', 'solicitado');

  get diagnostics v_canceladas = row_count;

  if coalesce(cardinality(v_retiros), 0) > 0 then
    foreach v_retiro_id in array v_retiros loop
      select coalesce(sum(rr.monto_mxn), 0)
      into v_total_retiro
      from public.referidos_recompensas rr
      where rr.retiro_id = v_retiro_id
        and rr.tipo = 'comision'
        and rr.estado = 'solicitado';

      if v_total_retiro > 0 then
        update public.referidos_retiros
        set monto_mxn = v_total_retiro,
            notas = case
              when v_motivo is null or position(v_motivo in coalesce(notas, '')) > 0 then notas
              else concat_ws(E'\n', nullif(notas, ''), v_motivo)
            end
        where id = v_retiro_id and estado = 'solicitado';
      else
        update public.referidos_retiros
        set estado = 'cancelado',
            notas = case
              when v_motivo is null or position(v_motivo in coalesce(notas, '')) > 0 then notas
              else concat_ws(E'\n', nullif(notas, ''), v_motivo)
            end
        where id = v_retiro_id and estado = 'solicitado';
      end if;
    end loop;
  end if;

  return v_canceladas;
end;
$$;

create or replace function public.referidos_detectar_primer_pago()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_comprado_en timestamptz;
  v_referido_id uuid;
  v_estado_actual text;
  v_suscripcion_id uuid;
  v_recompensa_irreversible boolean;
begin
  select r.id, r.estado, r.suscripcion_id
  into v_referido_id, v_estado_actual, v_suscripcion_id
  from public.referidos r
  where r.invitado_user_id = new.user_id
  for update;

  if not found then return new; end if;

  if new.estado_pago = 'pagado' and new.plan in ('premium', 'pro') and v_estado_actual = 'registrado' then
    v_comprado_en := coalesce(new.fecha_inicio, new.creado_en, now());

    update public.referidos
    set estado = 'validando',
        suscripcion_id = new.id,
        plan_comprado = new.plan,
        precio_base = case new.plan when 'premium' then 79.00 else 129.00 end,
        porcentaje_comision = 0,
        comision_mxn = null,
        comprado_en = v_comprado_en,
        valida_desde = v_comprado_en + interval '30 days',
        cancelado_en = null
    where invitado_user_id = new.user_id;
  elsif new.estado_pago in ('cancelado', 'reembolsado')
        and v_suscripcion_id = new.id
        and v_estado_actual in ('validando', 'aprobado') then
    perform public.referidos_cancelar_recompensas_v1(
      v_referido_id,
      'Recompensas canceladas porque el primer pago fue cancelado o reembolsado.'
    );

    select exists (
      select 1
      from public.referidos_recompensas rr
      where rr.referido_id = v_referido_id
        and rr.estado in ('canjeado', 'pagado')
    ) into v_recompensa_irreversible;

    update public.referidos
    set estado = case when estado = 'aprobado' then 'revision' else 'cancelado' end,
        cancelado_en = now(),
        nota_admin = concat_ws(
          E'\n',
          nullif(nota_admin, ''),
          'El primer pago fue cancelado o reembolsado. Las recompensas pendientes fueron canceladas.',
          case when v_recompensa_irreversible
            then 'Revisión manual necesaria: existe una recompensa ya canjeada o pagada.'
          end
        )
    where id = v_referido_id;
  end if;

  return new;
end;
$$;

drop trigger if exists ordely_detectar_primer_pago_referido on public.suscripciones;
create trigger ordely_detectar_primer_pago_referido
after insert or update of estado_pago on public.suscripciones
for each row execute function public.referidos_detectar_primer_pago();

-- Si una cuenta con código ya tenía un primer pago, lo incorpora sin crear premios todavía.
with primer_pago as (
  select distinct on (s.user_id)
    s.user_id,
    s.id,
    s.plan,
    coalesce(s.fecha_inicio, s.creado_en, now()) as comprado_en
  from public.suscripciones s
  where s.estado_pago = 'pagado' and s.plan in ('premium', 'pro')
  order by s.user_id, coalesce(s.fecha_inicio, s.creado_en, now()), s.creado_en, s.id
)
update public.referidos r
set estado = 'validando',
    suscripcion_id = pp.id,
    plan_comprado = pp.plan,
    precio_base = case pp.plan when 'premium' then 79.00 else 129.00 end,
    porcentaje_comision = 0,
    comision_mxn = null,
    comprado_en = pp.comprado_en,
    valida_desde = pp.comprado_en + interval '30 days'
from primer_pago pp
where r.invitado_user_id = pp.user_id
  and r.estado = 'registrado';

create or replace function public.admin_aprobar_referido_v1(p_referido_id uuid, p_nota text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_referido public.referidos;
  v_numero integer;
  v_tipo_premio text;
  v_plan_premio text;
  v_dias_premio integer;
  v_porcentaje numeric(5,2);
  v_comision numeric(10,2);
begin
  if not public.es_admin_actual() then raise exception 'Acceso no autorizado'; end if;

  select * into v_referido
  from public.referidos
  where id = p_referido_id
  for update;

  if not found then raise exception 'Referido no encontrado'; end if;
  if v_referido.estado <> 'validando' then raise exception 'Este referido no está pendiente de aprobación'; end if;
  if v_referido.valida_desde is null or v_referido.valida_desde > now() then
    raise exception 'Aún no termina el periodo de validación de 30 días';
  end if;
  if not exists (
    select 1 from public.suscripciones s
    where s.id = v_referido.suscripcion_id and s.estado_pago = 'pagado'
  ) then
    raise exception 'El primer pago ya no está confirmado';
  end if;

  perform public.referidos_asegurar_programa(v_referido.promotor_user_id);
  perform 1 from public.referidos_programas
  where user_id = v_referido.promotor_user_id
  for update;

  select count(*)::integer + 1 into v_numero
  from public.referidos
  where promotor_user_id = v_referido.promotor_user_id
    and estado = 'aprobado';

  v_porcentaje := case
    when v_numero < 20 then 0
    else least((v_numero / 10) * 10, 60)
  end;
  v_comision := round(coalesce(v_referido.precio_base, 0) * v_porcentaje / 100, 2);

  if v_numero < 10 then
    v_tipo_premio := 'dias_premium';
    v_plan_premio := 'premium';
    v_dias_premio := 15;
  elsif v_numero < 50 then
    v_tipo_premio := 'dias_premium';
    v_plan_premio := 'premium';
    v_dias_premio := 30;
  elsif v_numero < 75 then
    v_tipo_premio := 'dias_pro';
    v_plan_premio := 'pro';
    v_dias_premio := 15;
  elsif v_numero < 100 then
    v_tipo_premio := 'dias_pro';
    v_plan_premio := 'pro';
    v_dias_premio := 30;
  elsif v_numero = 100 then
    v_tipo_premio := 'pro_ilimitado';
    v_plan_premio := 'pro';
    v_dias_premio := null;
  end if;

  update public.referidos
  set estado = 'aprobado', aprobado_en = now(), aprobado_por = auth.uid(),
      porcentaje_comision = v_porcentaje,
      comision_mxn = case when v_porcentaje > 0 then v_comision else null end,
      nota_admin = nullif(btrim(coalesce(p_nota, '')), '')
  where id = v_referido.id;

  if v_tipo_premio in ('dias_premium', 'dias_pro') then
    insert into public.referidos_recompensas(
      promotor_user_id, referido_id, tipo, dias_premium, numero_referido, concepto
    ) values (
      v_referido.promotor_user_id, v_referido.id, v_tipo_premio, v_dias_premio, v_numero,
      format('%s días %s por el referido válido número %s', v_dias_premio, initcap(v_plan_premio), v_numero)
    ) on conflict do nothing;
  elsif v_tipo_premio = 'pro_ilimitado' then
    insert into public.referidos_recompensas(
      promotor_user_id, referido_id, tipo, numero_referido, concepto
    ) values (
      v_referido.promotor_user_id, v_referido.id, 'pro_ilimitado', v_numero,
      'Plan Pro ilimitado por alcanzar 100 referidos válidos'
    ) on conflict do nothing;
  end if;

  if v_porcentaje > 0 then
    update public.referidos_programas
    set promotor_desbloqueado_en = coalesce(promotor_desbloqueado_en, now()), actualizado_en = now()
    where user_id = v_referido.promotor_user_id;

    insert into public.referidos_recompensas(
      promotor_user_id, referido_id, tipo, monto_mxn, numero_referido, concepto
    ) values (
      v_referido.promotor_user_id, v_referido.id, 'comision', v_comision, v_numero,
      format('%s%% del precio regular de %s por el referido válido número %s', v_porcentaje, initcap(v_referido.plan_comprado), v_numero)
    ) on conflict do nothing;
  end if;

  return jsonb_build_object(
    'exito', true,
    'numero_referido', v_numero,
    'premio_plan', v_plan_premio,
    'dias_plan', v_dias_premio,
    'pro_ilimitado', v_tipo_premio = 'pro_ilimitado',
    'porcentaje_comision', v_porcentaje,
    'comision_mxn', case when v_porcentaje > 0 then v_comision else 0 end
  );
end;
$$;

create or replace function public.admin_rechazar_referido_v1(p_referido_id uuid, p_nota text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.es_admin_actual() then raise exception 'Acceso no autorizado'; end if;
  if char_length(btrim(coalesce(p_nota, ''))) < 3 then raise exception 'Indica el motivo del rechazo'; end if;

  update public.referidos
  set estado = 'rechazado',
      cancelado_en = now(),
      aprobado_por = auth.uid(),
      nota_admin = concat_ws(
        E'\n',
        btrim(p_nota),
        case when exists (
          select 1 from public.referidos_recompensas rr
          where rr.referido_id = p_referido_id and rr.estado in ('canjeado', 'pagado')
        ) then 'Revisión manual necesaria: existe una recompensa ya canjeada o pagada.' end
      )
  where id = p_referido_id and estado in ('registrado', 'validando', 'revision');

  if not found then raise exception 'El referido ya no se puede rechazar'; end if;

  perform public.referidos_cancelar_recompensas_v1(
    p_referido_id,
    'Recompensas canceladas al rechazar el referido.'
  );
end;
$$;

create or replace function public.admin_resolver_solicitud_referidos_v1(
  p_user_id uuid,
  p_aprobar boolean,
  p_nota text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.es_admin_actual() then raise exception 'Acceso no autorizado'; end if;
  if p_user_id is null then raise exception 'Solicitud no válida'; end if;
  if p_aprobar is null then raise exception 'Indica si la solicitud será aprobada o rechazada'; end if;
  if not p_aprobar and char_length(btrim(coalesce(p_nota, ''))) < 3 then
    raise exception 'Indica el motivo del rechazo';
  end if;

  perform 1
  from public.referidos_programas
  where user_id = p_user_id and estado = 'solicitado'
  for update;

  if not found then raise exception 'La solicitud ya fue procesada'; end if;

  update public.referidos_programas
  set estado = case when p_aprobar then 'activo' else 'rechazado' end,
      resuelto_en = now(),
      resuelto_por = auth.uid(),
      nota_admin = case when p_aprobar then null else btrim(p_nota) end,
      actualizado_en = now()
  where user_id = p_user_id;
end;
$$;

create or replace function public.mi_resumen_referidos_v1()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_programa public.referidos_programas;
  v_aprobados integer;
begin
  if v_user is null then raise exception 'Inicia sesión'; end if;

  select * into v_programa
  from public.referidos_programas
  where user_id = v_user;

  if not found then
    return jsonb_build_object('participacion_estado', 'no_solicitado');
  end if;

  if v_programa.estado <> 'activo' then
    return jsonb_build_object(
      'participacion_estado', v_programa.estado,
      'solicitado_en', v_programa.solicitado_en,
      'nota_admin', v_programa.nota_admin
    );
  end if;

  select count(*)::integer into v_aprobados
  from public.referidos where promotor_user_id = v_user and estado = 'aprobado';

  return jsonb_build_object(
    'participacion_estado', 'activo',
    'codigo', v_programa.codigo,
    'totales', jsonb_build_object(
      'registrados', (select count(*) from public.referidos where promotor_user_id = v_user),
      'validando', (select count(*) from public.referidos where promotor_user_id = v_user and estado = 'validando'),
      'aprobados', v_aprobados,
      'dias_disponibles', coalesce((select sum(dias_premium) from public.referidos_recompensas where promotor_user_id = v_user and tipo = 'dias_premium' and estado = 'disponible'), 0),
      'dias_pro_disponibles', coalesce((select sum(dias_premium) from public.referidos_recompensas where promotor_user_id = v_user and tipo = 'dias_pro' and estado = 'disponible'), 0),
      'pro_ilimitado_disponible', exists(select 1 from public.referidos_recompensas where promotor_user_id = v_user and tipo = 'pro_ilimitado' and estado = 'disponible'),
      'comision_disponible', coalesce((select sum(monto_mxn) from public.referidos_recompensas where promotor_user_id = v_user and tipo = 'comision' and estado = 'disponible'), 0)
    ),
    'referidos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'estado', r.estado,
        'plan_comprado', r.plan_comprado,
        'registrado_en', r.registrado_en
      ) order by r.registrado_en desc)
      from public.referidos r where r.promotor_user_id = v_user
    ), '[]'::jsonb),
    'recompensas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', rr.id,
        'tipo', rr.tipo,
        'estado', rr.estado,
        'dias_premium', rr.dias_premium,
        'monto_mxn', rr.monto_mxn,
        'concepto', rr.concepto,
        'creado_en', rr.creado_en
      ) order by rr.creado_en desc)
      from public.referidos_recompensas rr where rr.promotor_user_id = v_user
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.canjear_mis_dias_referidos_v1(p_recompensa_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_recompensa public.referidos_recompensas;
  v_perfil public.perfiles;
  v_base timestamptz;
  v_vence timestamptz;
begin
  if v_user is null then raise exception 'Inicia sesión'; end if;

  select rr.* into v_recompensa
  from public.referidos_recompensas rr
  join public.referidos r
    on r.id = rr.referido_id and r.estado = 'aprobado'
  join public.suscripciones s
    on s.id = r.suscripcion_id and s.estado_pago = 'pagado'
  where rr.id = p_recompensa_id
    and rr.promotor_user_id = v_user
  for update of rr;

  if not found
     or v_recompensa.tipo not in ('dias_premium', 'dias_pro', 'pro_ilimitado')
     or v_recompensa.estado <> 'disponible' then
    raise exception 'La recompensa no está disponible';
  end if;

  select * into v_perfil from public.perfiles where user_id = v_user for update;
  if not found then raise exception 'Perfil no encontrado'; end if;

  if v_recompensa.tipo = 'dias_premium'
     and v_perfil.plan_actual = 'pro'
     and (v_perfil.plan_expira_en is null or v_perfil.plan_expira_en > now()) then
    raise exception 'Tu crédito Premium se conserva. Podrás usarlo cuando termine tu Plan Pro';
  end if;

  if v_recompensa.tipo = 'pro_ilimitado' then
    v_vence := null;
    update public.perfiles
    set plan_actual = 'pro', plan_origen = 'regalo', plan_expira_en = null,
        limite_pedidos = 999999, cuenta_bloqueada = false,
        estado_suscripcion = 'activa', suscripcion_cancelada_en = null, actualizado_en = now()
    where user_id = v_user;
  else
    v_base := greatest(coalesce(v_perfil.plan_expira_en, now()), now());
    v_vence := v_base + make_interval(days => v_recompensa.dias_premium);

    update public.perfiles
    set plan_actual = case when v_recompensa.tipo = 'dias_pro' then 'pro' else 'premium' end,
        plan_origen = 'regalo', plan_expira_en = v_vence,
        limite_pedidos = 999999, cuenta_bloqueada = false,
        estado_suscripcion = 'activa', suscripcion_cancelada_en = null, actualizado_en = now()
    where user_id = v_user;
  end if;

  update public.referidos_recompensas
  set estado = 'canjeado', canjeado_en = now()
  where id = v_recompensa.id;

  return jsonb_build_object(
    'exito', true,
    'plan', case when v_recompensa.tipo = 'dias_premium' then 'premium' else 'pro' end,
    'dias', v_recompensa.dias_premium,
    'ilimitado', v_recompensa.tipo = 'pro_ilimitado',
    'vence_en', v_vence
  );
end;
$$;

create or replace function public.solicitar_pago_referidos_v1()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_monto numeric(10,2);
  v_retiro uuid;
begin
  if v_user is null then raise exception 'Inicia sesión'; end if;

  perform 1
  from public.referidos_recompensas rr
  join public.referidos r
    on r.id = rr.referido_id and r.estado = 'aprobado'
  join public.suscripciones s
    on s.id = r.suscripcion_id and s.estado_pago = 'pagado'
  where rr.promotor_user_id = v_user
    and rr.tipo = 'comision'
    and rr.estado = 'disponible'
  for update of rr;

  select coalesce(sum(rr.monto_mxn), 0) into v_monto
  from public.referidos_recompensas rr
  join public.referidos r
    on r.id = rr.referido_id and r.estado = 'aprobado'
  join public.suscripciones s
    on s.id = r.suscripcion_id and s.estado_pago = 'pagado'
  where rr.promotor_user_id = v_user
    and rr.tipo = 'comision'
    and rr.estado = 'disponible';

  if v_monto <= 0 then raise exception 'No tienes comisiones disponibles para solicitar'; end if;

  insert into public.referidos_retiros(promotor_user_id, monto_mxn)
  values (v_user, v_monto) returning id into v_retiro;

  update public.referidos_recompensas
  set estado = 'solicitado', retiro_id = v_retiro
  where id in (
    select rr.id
    from public.referidos_recompensas rr
    join public.referidos r
      on r.id = rr.referido_id and r.estado = 'aprobado'
    join public.suscripciones s
      on s.id = r.suscripcion_id and s.estado_pago = 'pagado'
    where rr.promotor_user_id = v_user
      and rr.tipo = 'comision'
      and rr.estado = 'disponible'
  );

  return jsonb_build_object('exito', true, 'retiro_id', v_retiro, 'monto_mxn', v_monto);
end;
$$;

create or replace function public.admin_listar_referidos_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.es_admin_actual() then raise exception 'Acceso no autorizado'; end if;

  return jsonb_build_object(
    'resumen', jsonb_build_object(
      'solicitudes_pendientes', (select count(*) from public.referidos_programas where estado = 'solicitado'),
      'registrados', (select count(*) from public.referidos),
      'validando', (select count(*) from public.referidos where estado = 'validando'),
      'aprobados', (select count(*) from public.referidos where estado = 'aprobado'),
      'requieren_revision', (select count(*) from public.referidos where estado = 'revision'),
      'comisiones_disponibles', coalesce((select sum(monto_mxn) from public.referidos_recompensas where tipo = 'comision' and estado = 'disponible'), 0),
      'retiros_pendientes', coalesce((select sum(monto_mxn) from public.referidos_retiros where estado = 'solicitado'), 0),
      'comisiones_pagadas', coalesce((select sum(monto_mxn) from public.referidos_retiros where estado = 'pagado'), 0)
    ),
    'solicitudes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', rp.user_id,
        'nombre', p.nombre,
        'correo', p.correo,
        'estado', rp.estado,
        'solicitado_en', rp.solicitado_en,
        'resuelto_en', rp.resuelto_en,
        'nota_admin', rp.nota_admin
      ) order by case rp.estado when 'solicitado' then 0 when 'activo' then 1 else 2 end, rp.solicitado_en desc)
      from public.referidos_programas rp
      join public.perfiles p on p.user_id = rp.user_id
    ), '[]'::jsonb),
    'referidos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'promotor_user_id', r.promotor_user_id,
        'promotor_nombre', promotor.nombre,
        'promotor_correo', promotor.correo,
        'invitado_user_id', r.invitado_user_id,
        'invitado_nombre', invitado.nombre,
        'invitado_correo', invitado.correo,
        'estado', r.estado,
        'plan_comprado', r.plan_comprado,
        'precio_base', r.precio_base,
        'porcentaje_comision', r.porcentaje_comision,
        'comision_mxn', r.comision_mxn,
        'registrado_en', r.registrado_en,
        'comprado_en', r.comprado_en,
        'valida_desde', r.valida_desde,
        'aprobado_en', r.aprobado_en,
        'nota_admin', r.nota_admin
      ) order by r.registrado_en desc)
      from public.referidos r
      join public.perfiles promotor on promotor.user_id = r.promotor_user_id
      join public.perfiles invitado on invitado.user_id = r.invitado_user_id
    ), '[]'::jsonb),
    'retiros', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', rt.id,
        'promotor_user_id', rt.promotor_user_id,
        'promotor_nombre', p.nombre,
        'promotor_correo', p.correo,
        'monto_mxn', rt.monto_mxn,
        'estado', rt.estado,
        'solicitado_en', rt.solicitado_en,
        'pagado_en', rt.pagado_en,
        'referencia_pago', rt.referencia_pago,
        'notas', rt.notas
      ) order by rt.solicitado_en desc)
      from public.referidos_retiros rt
      join public.perfiles p on p.user_id = rt.promotor_user_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_marcar_retiro_referidos_pagado_v1(
  p_retiro_id uuid,
  p_referencia text,
  p_notas text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.es_admin_actual() then raise exception 'Acceso no autorizado'; end if;
  if char_length(btrim(coalesce(p_referencia, ''))) < 3 then raise exception 'Registra una referencia de pago'; end if;

  update public.referidos_retiros
  set estado = 'pagado', pagado_en = now(), procesado_por = auth.uid(),
      referencia_pago = btrim(p_referencia), notas = nullif(btrim(coalesce(p_notas, '')), '')
  where id = p_retiro_id and estado = 'solicitado';

  if not found then raise exception 'El retiro ya no está pendiente'; end if;

  update public.referidos_recompensas
  set estado = 'pagado', pagado_en = now()
  where retiro_id = p_retiro_id and estado = 'solicitado';
end;
$$;

revoke all on public.referidos_programas from anon, authenticated;
revoke all on public.referidos from anon, authenticated;
revoke all on public.referidos_recompensas from anon, authenticated;
revoke all on public.referidos_retiros from anon, authenticated;

grant select on public.referidos_programas to authenticated;
grant select on public.referidos to authenticated;
grant select on public.referidos_recompensas to authenticated;
grant select on public.referidos_retiros to authenticated;

revoke all on function public.ordely_codigo_referido(uuid) from public, anon, authenticated;
revoke all on function public.validar_codigo_referido_v1(text) from public, anon, authenticated;
revoke all on function public.referidos_asegurar_programa(uuid) from public, anon, authenticated;
revoke all on function public.referidos_cancelar_recompensas_v1(uuid, text) from public, anon, authenticated;
revoke all on function public.solicitar_programa_referidos_v1() from public, anon;
revoke all on function public.referidos_vincular_perfil_nuevo() from public, anon, authenticated;
revoke all on function public.referidos_detectar_primer_pago() from public, anon, authenticated;
revoke all on function public.admin_aprobar_referido_v1(uuid, text) from public, anon;
revoke all on function public.admin_rechazar_referido_v1(uuid, text) from public, anon;
revoke all on function public.admin_resolver_solicitud_referidos_v1(uuid, boolean, text) from public, anon;
revoke all on function public.mi_resumen_referidos_v1() from public, anon;
revoke all on function public.canjear_mis_dias_referidos_v1(uuid) from public, anon;
revoke all on function public.solicitar_pago_referidos_v1() from public, anon;
revoke all on function public.admin_listar_referidos_v1() from public, anon;
revoke all on function public.admin_marcar_retiro_referidos_pagado_v1(uuid, text, text) from public, anon;

grant execute on function public.admin_aprobar_referido_v1(uuid, text) to authenticated;
grant execute on function public.admin_rechazar_referido_v1(uuid, text) to authenticated;
grant execute on function public.admin_resolver_solicitud_referidos_v1(uuid, boolean, text) to authenticated;
grant execute on function public.solicitar_programa_referidos_v1() to authenticated;
grant execute on function public.mi_resumen_referidos_v1() to authenticated;
grant execute on function public.canjear_mis_dias_referidos_v1(uuid) to authenticated;
grant execute on function public.solicitar_pago_referidos_v1() to authenticated;
grant execute on function public.admin_listar_referidos_v1() to authenticated;
grant execute on function public.admin_marcar_retiro_referidos_pagado_v1(uuid, text, text) to authenticated;
grant execute on function public.validar_codigo_referido_v1(text) to anon, authenticated;

commit;
