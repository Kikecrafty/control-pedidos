-- Ordely v1.1 - integridad de pedidos, pagos, compras, folios y planes.
-- Esta migracion es revisable y no se aplica automaticamente al proyecto remoto.

begin;

-- ---------------------------------------------------------------------------
-- Restricciones monetarias y de unicidad que los datos actuales ya cumplen.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ordely_pagos_monto_positivo'
      and conrelid = 'public.pagos'::regclass
  ) then
    alter table public.pagos
      add constraint ordely_pagos_monto_positivo
      check (monto > 0 and monto <> 'NaN'::numeric) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ordely_productos_montos_validos'
      and conrelid = 'public.productos_pedido'::regclass
  ) then
    alter table public.productos_pedido
      add constraint ordely_productos_montos_validos
      check (
        cantidad > 0
        and coalesce(precio_pagina, 0) >= 0
        and coalesce(precio_shein, 0) >= 0
        and coalesce(precio_venta, 0) >= 0
        and coalesce(costo_real_total, 0) >= 0
        and coalesce(costo_real_unitario, 0) >= 0
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ordely_pedidos_montos_validos'
      and conrelid = 'public.pedidos'::regclass
  ) then
    alter table public.pedidos
      add constraint ordely_pedidos_montos_validos
      check (
        coalesce(total_shein, 0) >= 0
        and coalesce(total_cliente, 0) >= 0
        and coalesce(anticipo, 0) >= 0
        and coalesce(restante, 0) >= 0
        and coalesce(reembolso_monto, 0) >= 0
        and coalesce(reembolso_monto, 0) <= coalesce(anticipo, 0)
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ordely_lotes_montos_validos'
      and conrelid = 'public.lotes_compra'::regclass
  ) then
    alter table public.lotes_compra
      add constraint ordely_lotes_montos_validos
      check (
        subtotal_pagina >= 0
        and descuento_cupon >= 0
        and puntos_total >= 0
        and descuento_total >= 0
        and envio >= 0
        and importacion >= 0
        and impuestos >= 0
        and comisiones >= 0
        and total_productos_con_descuento >= 0
        and costos_extra_total >= 0
        and total_pagado >= 0
      ) not valid;
  end if;
end;
$$;

alter table public.pagos validate constraint ordely_pagos_monto_positivo;
alter table public.productos_pedido validate constraint ordely_productos_montos_validos;
alter table public.pedidos validate constraint ordely_pedidos_montos_validos;
alter table public.lotes_compra validate constraint ordely_lotes_montos_validos;

create unique index if not exists lote_productos_producto_unico_idx
  on public.lote_productos (producto_pedido_id);

create unique index if not exists lotes_compra_user_codigo_unico_idx
  on public.lotes_compra (user_id, codigo_lote);

alter table public.perfiles
  drop constraint if exists perfiles_plataforma_check;

alter table public.perfiles
  add constraint perfiles_plataforma_check
  check (plataforma_predeterminada in (
    'SHEIN',
    'Temu',
    'AliExpress',
    'TikTok Shop',
    'Mercado Libre',
    'Amazon',
    'Catálogo',
    'Otro'
  ));

-- ---------------------------------------------------------------------------
-- Recalculo central. La funcion interna solo queda disponible para triggers y
-- funciones del propietario; la version publica comprueba al dueño del pedido.
-- ---------------------------------------------------------------------------

create or replace function public.ordely_recalcular_totales_pedido_interno(
  p_pedido_id uuid
) returns public.pedidos
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pedido public.pedidos%rowtype;
  v_total_plataforma numeric := 0;
  v_total_cliente numeric := 0;
  v_pagado numeric := 0;
begin
  select p.*
  into v_pedido
  from public.pedidos p
  where p.id = p_pedido_id
  for update;

  if not found then
    raise exception 'Pedido no encontrado';
  end if;

  select
    coalesce(sum(coalesce(pp.costo_real_total, pp.precio_shein * pp.cantidad, 0)), 0),
    coalesce(sum(coalesce(pp.precio_venta, 0) * coalesce(pp.cantidad, 0)), 0)
  into v_total_plataforma, v_total_cliente
  from public.productos_pedido pp
  where pp.pedido_id = p_pedido_id
    and pp.user_id = v_pedido.user_id;

  select coalesce(sum(pg.monto), 0)
  into v_pagado
  from public.pagos pg
  where pg.pedido_id = p_pedido_id
    and pg.user_id = v_pedido.user_id;

  update public.pedidos p
  set total_shein = round(v_total_plataforma, 2),
      total_cliente = round(v_total_cliente, 2),
      anticipo = round(v_pagado, 2),
      restante = round(greatest(v_total_cliente - v_pagado, 0), 2),
      ganancia = round(v_total_cliente - v_total_plataforma, 2)
  where p.id = p_pedido_id
  returning p.* into v_pedido;

  return v_pedido;
end;
$$;

create or replace function public.recalcular_totales_pedido(
  p_pedido_id uuid
) returns public.pedidos
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'No autorizado';
  end if;

  if not exists (
    select 1
    from public.pedidos p
    where p.id = p_pedido_id
      and p.user_id = auth.uid()
  ) then
    raise exception 'Pedido no encontrado';
  end if;

  return public.ordely_recalcular_totales_pedido_interno(p_pedido_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Integridad entre cuentas, clientes, pedidos, productos, pagos y lotes.
-- ---------------------------------------------------------------------------

create or replace function public.ordely_validar_pedido_integridad()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;

  if new.user_id is null then
    raise exception 'El pedido debe pertenecer a una cuenta';
  end if;

  if new.cliente_id is not null and not exists (
    select 1
    from public.clientes c
    where c.id = new.cliente_id
      and c.user_id = new.user_id
  ) then
    raise exception 'El cliente seleccionado no pertenece a esta cuenta';
  end if;

  if coalesce(new.reembolso, false)
     and coalesce(new.reembolso_monto, 0) > coalesce(new.anticipo, 0) then
    raise exception 'El reembolso no puede superar lo pagado por el cliente';
  end if;

  if new.estado = 'Entregado'
     and (tg_op = 'INSERT' or old.estado is distinct from new.estado)
     and (
       not exists (
         select 1 from public.productos_pedido pp
         where pp.pedido_id = new.id
       )
       or exists (
         select 1
         from public.productos_pedido pp
         where pp.pedido_id = new.id
           and (
             coalesce(pp.entregado, false) = false
             or coalesce(pp.estado_compra, '') <> 'Entregado'
           )
       )
     ) then
    raise exception 'No se puede entregar el pedido mientras haya productos pendientes';
  end if;

  return new;
end;
$$;

drop trigger if exists ordely_validar_pedido_integridad_trigger on public.pedidos;
create trigger ordely_validar_pedido_integridad_trigger
before insert or update on public.pedidos
for each row execute function public.ordely_validar_pedido_integridad();

create or replace function public.ordely_validar_producto_integridad()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
begin
  if tg_op = 'DELETE' then
    if old.lote_compra_id is not null then
      raise exception 'Un producto con compra registrada no se puede eliminar';
    end if;
    return old;
  end if;

  select p.user_id
  into v_user_id
  from public.pedidos p
  where p.id = new.pedido_id;

  if not found then
    raise exception 'El pedido del producto no existe';
  end if;

  if new.user_id is null then
    new.user_id := v_user_id;
  end if;

  if new.user_id <> v_user_id then
    raise exception 'El producto y el pedido deben pertenecer a la misma cuenta';
  end if;

  if new.lote_compra_id is not null and not exists (
    select 1
    from public.lotes_compra lc
    where lc.id = new.lote_compra_id
      and lc.user_id = v_user_id
  ) then
    raise exception 'El lote del producto no pertenece a esta cuenta';
  end if;

  if tg_op = 'UPDATE'
     and old.lote_compra_id is not null
     and (
       old.pedido_id is distinct from new.pedido_id
       or old.user_id is distinct from new.user_id
       or old.lote_compra_id is distinct from new.lote_compra_id
       or old.cantidad is distinct from new.cantidad
       or old.precio_pagina is distinct from new.precio_pagina
       or old.precio_shein is distinct from new.precio_shein
       or old.precio_venta is distinct from new.precio_venta
       or old.costo_real_total is distinct from new.costo_real_total
       or old.costo_real_unitario is distinct from new.costo_real_unitario
     ) then
    raise exception 'Los importes de un producto comprado forman parte del historial y no se pueden modificar';
  end if;

  return new;
end;
$$;

drop trigger if exists ordely_validar_producto_integridad_trigger on public.productos_pedido;
create trigger ordely_validar_producto_integridad_trigger
before insert or update or delete on public.productos_pedido
for each row execute function public.ordely_validar_producto_integridad();

create or replace function public.ordely_recalcular_por_producto()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform public.ordely_recalcular_totales_pedido_interno(old.pedido_id);
    return old;
  end if;

  perform public.ordely_recalcular_totales_pedido_interno(new.pedido_id);

  if tg_op = 'UPDATE' and old.pedido_id is distinct from new.pedido_id then
    perform public.ordely_recalcular_totales_pedido_interno(old.pedido_id);
  end if;

  return new;
end;
$$;

drop trigger if exists ordely_recalcular_por_producto_trigger on public.productos_pedido;
create trigger ordely_recalcular_por_producto_trigger
after insert or delete or update of pedido_id, cantidad, precio_shein, precio_venta,
  costo_real_total, costo_real_unitario
on public.productos_pedido
for each row execute function public.ordely_recalcular_por_producto();

create or replace function public.ordely_validar_pago_integridad()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pedido public.pedidos%rowtype;
  v_otros_pagos numeric := 0;
begin
  select p.*
  into v_pedido
  from public.pedidos p
  where p.id = case when tg_op = 'DELETE' then old.pedido_id else new.pedido_id end
  for update;

  if not found then
    raise exception 'El pedido del pago no existe';
  end if;

  if v_pedido.estado in ('Cancelado', 'Devuelto') then
    raise exception 'Un pedido cancelado o devuelto no permite modificar pagos';
  end if;

  if tg_op in ('UPDATE', 'DELETE')
     and coalesce(old.notas, '') ~ '\[(producto|entrega-pedido):' then
    raise exception 'Este pago fue generado por una entrega y no puede modificarse por separado';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if new.user_id is null then
    new.user_id := v_pedido.user_id;
  end if;

  if new.user_id <> v_pedido.user_id then
    raise exception 'El pago y el pedido deben pertenecer a la misma cuenta';
  end if;

  if new.monto is null or new.monto <= 0 or new.monto = 'NaN'::numeric then
    raise exception 'El pago debe ser mayor a cero';
  end if;

  if trim(coalesce(new.metodo_pago, '')) = '' or new.fecha_pago is null then
    raise exception 'El pago debe incluir metodo y fecha';
  end if;

  select coalesce(sum(pg.monto), 0)
  into v_otros_pagos
  from public.pagos pg
  where pg.pedido_id = v_pedido.id
    and pg.user_id = v_pedido.user_id
    and (tg_op = 'INSERT' or pg.id <> old.id);

  if v_otros_pagos + new.monto > coalesce(v_pedido.total_cliente, 0) + 0.005 then
    raise exception 'El pago supera el saldo pendiente del pedido';
  end if;

  return new;
end;
$$;

drop trigger if exists ordely_validar_pago_integridad_trigger on public.pagos;
create trigger ordely_validar_pago_integridad_trigger
before insert or update or delete on public.pagos
for each row execute function public.ordely_validar_pago_integridad();

create or replace function public.ordely_recalcular_por_pago()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform public.ordely_recalcular_totales_pedido_interno(old.pedido_id);
    return old;
  end if;

  perform public.ordely_recalcular_totales_pedido_interno(new.pedido_id);

  if tg_op = 'UPDATE' and old.pedido_id is distinct from new.pedido_id then
    perform public.ordely_recalcular_totales_pedido_interno(old.pedido_id);
  end if;

  return new;
end;
$$;

drop trigger if exists ordely_recalcular_por_pago_trigger on public.pagos;
create trigger ordely_recalcular_por_pago_trigger
after insert or update or delete on public.pagos
for each row execute function public.ordely_recalcular_por_pago();

create or replace function public.ordely_validar_lote_producto_integridad()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lote_user uuid;
  v_producto_user uuid;
  v_producto_pedido uuid;
begin
  select lc.user_id into v_lote_user
  from public.lotes_compra lc
  where lc.id = new.lote_id;

  select pp.user_id, pp.pedido_id
  into v_producto_user, v_producto_pedido
  from public.productos_pedido pp
  where pp.id = new.producto_pedido_id;

  if v_lote_user is null or v_producto_user is null then
    raise exception 'El lote o el producto no existe';
  end if;

  if v_lote_user <> v_producto_user
     or new.pedido_id <> v_producto_pedido
     or not exists (
       select 1
       from public.pedidos p
       where p.id = new.pedido_id
         and p.user_id = v_lote_user
     ) then
    raise exception 'El lote, producto y pedido deben pertenecer a la misma cuenta';
  end if;

  return new;
end;
$$;

drop trigger if exists ordely_validar_lote_producto_integridad_trigger on public.lote_productos;
create trigger ordely_validar_lote_producto_integridad_trigger
before insert or update on public.lote_productos
for each row execute function public.ordely_validar_lote_producto_integridad();

create or replace function public.ordely_validar_lote_integridad()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total_calculado numeric;
begin
  v_total_calculado := round(
    coalesce(new.total_productos_con_descuento, 0)
    + coalesce(new.costos_extra_total, 0),
    2
  );

  if abs(coalesce(new.total_pagado, 0) - v_total_calculado) > 0.009 then
    raise exception 'El total pagado no coincide con productos, descuentos y costos extra';
  end if;

  return new;
end;
$$;

drop trigger if exists ordely_validar_lote_integridad_trigger on public.lotes_compra;
create trigger ordely_validar_lote_integridad_trigger
before insert or update on public.lotes_compra
for each row execute function public.ordely_validar_lote_integridad();

-- ---------------------------------------------------------------------------
-- Plan Basico: el limite solo impide pedidos nuevos y se cuenta por periodo.
-- ---------------------------------------------------------------------------

create or replace function public.contar_intentos_pedidos(
  p_user uuid default auth.uid()
) returns bigint
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_inicio timestamptz;
  v_total bigint;
begin
  if p_user is null then
    return 0;
  end if;

  if auth.uid() is not null
     and p_user <> auth.uid()
     and not public.es_admin_actual() then
    raise exception 'No autorizado';
  end if;

  select p.periodo_inicia_en
  into v_inicio
  from public.perfiles p
  where p.user_id = p_user;

  select count(*)::bigint
  into v_total
  from public.pedidos_intentos pi
  where pi.user_id = p_user
    and pi.creado_en >= coalesce(v_inicio, '-infinity'::timestamptz);

  return coalesce(v_total, 0);
end;
$$;

create or replace function public.usuario_puede_crear_pedido(
  p_user uuid default auth.uid()
) returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_perfil public.perfiles%rowtype;
  v_plan text;
begin
  if p_user is null then
    return false;
  end if;

  if auth.uid() is not null
     and p_user <> auth.uid()
     and not public.es_admin_actual() then
    return false;
  end if;

  select p.* into v_perfil
  from public.perfiles p
  where p.user_id = p_user;

  if not found
     or coalesce(v_perfil.cuenta_bloqueada, false)
     or v_perfil.estado_suscripcion = 'suspendida' then
    return false;
  end if;

  if coalesce(v_perfil.es_admin, false) then
    return true;
  end if;

  v_plan := lower(coalesce(v_perfil.plan_actual, 'basico'));
  if v_perfil.plan_expira_en is not null and v_perfil.plan_expira_en < now() then
    v_plan := 'basico';
  end if;

  if v_plan in ('premium', 'pro') then
    return true;
  end if;

  return public.contar_intentos_pedidos(p_user) < coalesce(v_perfil.limite_pedidos, 30);
end;
$$;

create or replace function public.bloquear_crear_pedido_si_limite()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := coalesce(new.user_id, auth.uid());
  v_perfil public.perfiles%rowtype;
  v_plan text;
  v_usados bigint;
begin
  if v_user is null then
    raise exception 'Usuario no autenticado';
  end if;

  new.user_id := v_user;

  select p.* into v_perfil
  from public.perfiles p
  where p.user_id = v_user
  for update;

  if not found then
    raise exception 'No se encontro el perfil de la cuenta';
  end if;

  if coalesce(v_perfil.cuenta_bloqueada, false)
     or v_perfil.estado_suscripcion = 'suspendida' then
    raise exception 'Tu cuenta esta suspendida';
  end if;

  if coalesce(v_perfil.es_admin, false) then
    return new;
  end if;

  v_plan := lower(coalesce(v_perfil.plan_actual, 'basico'));
  if v_perfil.plan_expira_en is not null and v_perfil.plan_expira_en < now() then
    v_plan := 'basico';
  end if;

  if v_plan = 'basico' then
    v_usados := public.contar_intentos_pedidos(v_user);
    if v_usados >= coalesce(v_perfil.limite_pedidos, 30) then
      raise exception 'Limite del Plan Basico alcanzado. Actualiza tu plan para crear mas pedidos.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists ordely_bloquear_pedido_nuevo on public.pedidos;
drop trigger if exists trigger_bloquear_crear_pedido_si_limite on public.pedidos;
drop trigger if exists ordely_bloquear_compra_nueva on public.lotes_compra;
drop trigger if exists ordely_sincronizar_pedidos_usados_trigger on public.pedidos;

create trigger ordely_bloquear_pedido_nuevo
before insert on public.pedidos
for each row execute function public.bloquear_crear_pedido_si_limite();

create or replace function public.registrar_intento_pedido_creado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.pedidos_intentos (user_id, pedido_id, creado_en, origen)
  values (new.user_id, new.id, coalesce(new.fecha_cotizado, now()), 'pedido_creado')
  on conflict (pedido_id) do nothing;

  update public.perfiles p
  set pedidos_usados = public.contar_intentos_pedidos(new.user_id),
      actualizado_en = now()
  where p.user_id = new.user_id;

  return new;
end;
$$;

drop trigger if exists trigger_registrar_intento_pedido_creado on public.pedidos;
create trigger trigger_registrar_intento_pedido_creado
after insert on public.pedidos
for each row execute function public.registrar_intento_pedido_creado();

create or replace function public.mi_estado_plan()
returns table(
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
  pedidos_usados bigint,
  limite_alcanzado boolean,
  puede_crear_pedido boolean,
  puede_modificar boolean,
  plan_vencido boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_perfil public.perfiles%rowtype;
  v_intentos bigint;
  v_plan text;
  v_vencido boolean;
begin
  if v_user is null then
    return;
  end if;

  select p.* into v_perfil
  from public.perfiles p
  where p.user_id = v_user;

  if not found then
    return;
  end if;

  v_intentos := public.contar_intentos_pedidos(v_user);
  v_vencido := v_perfil.plan_expira_en is not null and v_perfil.plan_expira_en < now();
  v_plan := case when v_vencido then 'basico' else lower(coalesce(v_perfil.plan_actual, 'basico')) end;

  return query
  select
    v_perfil.user_id,
    v_perfil.nombre,
    v_perfil.correo,
    v_plan,
    v_perfil.plan_origen,
    v_perfil.plan_expira_en,
    v_perfil.limite_pedidos,
    v_perfil.es_admin,
    v_perfil.cuenta_bloqueada,
    v_perfil.plataforma_predeterminada,
    v_intentos,
    (v_plan = 'basico' and v_intentos >= coalesce(v_perfil.limite_pedidos, 30)),
    public.usuario_puede_crear_pedido(v_user),
    (
      not coalesce(v_perfil.cuenta_bloqueada, false)
      and v_perfil.estado_suscripcion <> 'suspendida'
    ),
    v_vencido;
end;
$$;

-- ---------------------------------------------------------------------------
-- Plataformas y folios secuenciales por cuenta/plataforma.
-- ---------------------------------------------------------------------------

create or replace function public.actualizar_mi_plataforma(p_plataforma text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'No autorizado';
  end if;

  if p_plataforma not in (
    'SHEIN', 'Temu', 'AliExpress', 'TikTok Shop',
    'Mercado Libre', 'Amazon', 'Catálogo', 'Otro'
  ) then
    raise exception 'Plataforma no valida';
  end if;

  update public.perfiles p
  set plataforma_predeterminada = p_plataforma,
      actualizado_en = now()
  where p.user_id = auth.uid();

  if not found then
    raise exception 'Perfil no encontrado';
  end if;
end;
$$;

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
  elsif v_plataforma like '%cat%' then
    return coalesce(v_perfil.tiempo_catalogo_dias, 7);
  elsif v_plataforma like '%tiktok%'
     or v_plataforma like '%mercado%'
     or v_plataforma like '%amazon%'
     or v_plataforma like '%otro%' then
    return coalesce(v_perfil.tiempo_otro_dias, 15);
  end if;

  return coalesce(v_perfil.tiempo_shein_dias, 10);
end;
$$;

create or replace function public.generar_codigo_pedido(p_plataforma text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_raw text := lower(translate(
    coalesce(nullif(trim(p_plataforma), ''), 'Otro'),
    'ÁÉÍÓÚÜáéíóúü',
    'AEIOUUaeiouu'
  ));
  v_plataforma text;
  v_prefijo text;
  v_max_existente bigint;
  v_siguiente bigint;
begin
  if v_user is null then
    raise exception 'No autenticado';
  end if;

  if v_raw like '%shein%' then
    v_plataforma := 'SHEIN'; v_prefijo := 'SHN';
  elsif v_raw like '%temu%' then
    v_plataforma := 'Temu'; v_prefijo := 'TEM';
  elsif v_raw like '%aliexpress%' or v_raw like '%ali express%' then
    v_plataforma := 'AliExpress'; v_prefijo := 'ALI';
  elsif v_raw like '%tiktok%' then
    v_plataforma := 'TikTok Shop'; v_prefijo := 'TTS';
  elsif v_raw like '%mercado libre%' then
    v_plataforma := 'Mercado Libre'; v_prefijo := 'ML';
  elsif v_raw like '%amazon%' then
    v_plataforma := 'Amazon'; v_prefijo := 'AMZ';
  elsif v_raw like '%catalogo%' then
    v_plataforma := 'Catálogo'; v_prefijo := 'CAT';
  else
    v_plataforma := 'Otro'; v_prefijo := 'OTR';
  end if;

  select coalesce(max((substring(p.codigo from ('^' || v_prefijo || '-([0-9]+)$')))::bigint), 0)
  into v_max_existente
  from public.pedidos p
  where p.user_id = v_user
    and p.codigo ~ ('^' || v_prefijo || '-[0-9]+$');

  insert into public.pedido_folios_usuario (user_id, plataforma, ultimo_numero)
  values (v_user, v_plataforma, v_max_existente)
  on conflict (user_id, plataforma)
  do update set ultimo_numero = greatest(
                  public.pedido_folios_usuario.ultimo_numero,
                  excluded.ultimo_numero
                ),
                actualizado_en = now();

  update public.pedido_folios_usuario pf
  set ultimo_numero = pf.ultimo_numero + 1,
      actualizado_en = now()
  where pf.user_id = v_user
    and pf.plataforma = v_plataforma
  returning pf.ultimo_numero into v_siguiente;

  return v_prefijo || '-' || v_siguiente;
end;
$$;

-- ---------------------------------------------------------------------------
-- Creacion atomica de pedido, productos y anticipo con sus metadatos reales.
-- Se conserva la firma anterior como compatibilidad para clientes antiguos.
-- ---------------------------------------------------------------------------

create or replace function public.crear_pedido_completo(
  p_cliente_id uuid,
  p_plataforma text,
  p_estado text,
  p_tracking text,
  p_notas text,
  p_productos jsonb,
  p_anticipo numeric,
  p_fecha_creacion date,
  p_metodo_anticipo text,
  p_fecha_anticipo date
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_perfil public.perfiles%rowtype;
  v_total_plataforma numeric := 0;
  v_total_cliente numeric := 0;
  v_anticipo numeric := round(coalesce(p_anticipo, 0), 2);
  v_pedido public.pedidos%rowtype;
  v_codigo text;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesion para crear un pedido';
  end if;

  select p.* into v_perfil
  from public.perfiles p
  where p.user_id = v_user
  for update;

  if not found then
    raise exception 'No se encontro el perfil de la cuenta';
  end if;

  if not public.usuario_puede_crear_pedido(v_user) then
    raise exception 'Limite del Plan Basico alcanzado. Actualiza tu plan para crear mas pedidos';
  end if;

  if not exists (
    select 1
    from public.clientes c
    where c.id = p_cliente_id
      and c.user_id = v_user
  ) then
    raise exception 'El cliente seleccionado no pertenece a esta cuenta';
  end if;

  if p_productos is null
     or jsonb_typeof(p_productos) <> 'array'
     or jsonb_array_length(p_productos) = 0 then
    raise exception 'Agrega al menos un producto al pedido';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_productos) producto
    where trim(coalesce(producto ->> 'nombre_producto', '')) = ''
       or coalesce(nullif(producto ->> 'cantidad', '')::numeric, 0) <= 0
       or coalesce(nullif(producto ->> 'cantidad', '')::numeric, 0)
          <> trunc(coalesce(nullif(producto ->> 'cantidad', '')::numeric, 0))
       or coalesce(nullif(producto ->> 'precio_pagina', '')::numeric, -1) < 0
       or coalesce(
            nullif(producto ->> 'precio_venta', '')::numeric,
            nullif(producto ->> 'precio_pagina', '')::numeric,
            -1
          ) < 0
  ) then
    raise exception 'Revisa el nombre, la cantidad y los precios de los productos';
  end if;

  select
    round(coalesce(sum(
      coalesce(
        nullif(producto ->> 'precio_shein', '')::numeric,
        nullif(producto ->> 'precio_pagina', '')::numeric,
        0
      ) * coalesce(nullif(producto ->> 'cantidad', '')::numeric, 0)
    ), 0), 2),
    round(coalesce(sum(
      coalesce(
        nullif(producto ->> 'precio_venta', '')::numeric,
        nullif(producto ->> 'precio_pagina', '')::numeric,
        0
      ) * coalesce(nullif(producto ->> 'cantidad', '')::numeric, 0)
    ), 0), 2)
  into v_total_plataforma, v_total_cliente
  from jsonb_array_elements(p_productos) producto;

  if v_anticipo < 0 or v_anticipo = 'NaN'::numeric then
    raise exception 'El anticipo no puede ser negativo';
  end if;

  if v_anticipo > v_total_cliente then
    raise exception 'El anticipo no puede ser mayor al total del cliente';
  end if;

  if v_anticipo > 0 and trim(coalesce(p_metodo_anticipo, '')) = '' then
    raise exception 'Selecciona el metodo del anticipo';
  end if;

  if coalesce(nullif(trim(p_estado), ''), 'Cotizado') <> 'Cotizado' then
    raise exception 'Todo pedido nuevo debe iniciar como Cotizado';
  end if;

  v_codigo := public.generar_codigo_pedido(p_plataforma);

  insert into public.pedidos (
    user_id,
    cliente_id,
    codigo,
    plataforma,
    estado,
    total_shein,
    total_cliente,
    anticipo,
    restante,
    ganancia,
    tracking,
    notas,
    fecha_pedido
  ) values (
    v_user,
    p_cliente_id,
    v_codigo,
    coalesce(nullif(trim(p_plataforma), ''), 'SHEIN'),
    'Cotizado',
    v_total_plataforma,
    v_total_cliente,
    v_anticipo,
    round(v_total_cliente - v_anticipo, 2),
    round(v_total_cliente - v_total_plataforma, 2),
    trim(coalesce(p_tracking, '')),
    trim(coalesce(p_notas, '')),
    coalesce(p_fecha_creacion, current_date)
  ) returning * into v_pedido;

  insert into public.productos_pedido (
    user_id,
    pedido_id,
    nombre_producto,
    link_shein,
    talla,
    color,
    cantidad,
    precio_pagina,
    precio_shein,
    precio_venta
  )
  select
    v_user,
    v_pedido.id,
    trim(producto ->> 'nombre_producto'),
    trim(coalesce(producto ->> 'link_shein', '')),
    trim(coalesce(producto ->> 'talla', '')),
    trim(coalesce(producto ->> 'color', '')),
    (producto ->> 'cantidad')::integer,
    round(coalesce(nullif(producto ->> 'precio_pagina', '')::numeric, 0), 2),
    round(coalesce(
      nullif(producto ->> 'precio_shein', '')::numeric,
      nullif(producto ->> 'precio_pagina', '')::numeric,
      0
    ), 2),
    round(coalesce(
      nullif(producto ->> 'precio_venta', '')::numeric,
      nullif(producto ->> 'precio_pagina', '')::numeric,
      0
    ), 2)
  from jsonb_array_elements(p_productos) producto;

  if v_anticipo > 0 then
    insert into public.pagos (
      user_id,
      pedido_id,
      monto,
      metodo_pago,
      fecha_pago,
      notas,
      tipo
    ) values (
      v_user,
      v_pedido.id,
      v_anticipo,
      trim(p_metodo_anticipo),
      coalesce(p_fecha_anticipo, p_fecha_creacion, current_date),
      'Pago inicial',
      'pago'
    );
  end if;

  select p.* into v_pedido
  from public.pedidos p
  where p.id = v_pedido.id;

  return to_jsonb(v_pedido);
end;
$$;

create or replace function public.crear_pedido_completo(
  p_cliente_id uuid,
  p_plataforma text,
  p_estado text,
  p_tracking text,
  p_notas text,
  p_productos jsonb,
  p_anticipo numeric,
  p_fecha_creacion date
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return public.crear_pedido_completo(
    p_cliente_id,
    p_plataforma,
    p_estado,
    p_tracking,
    p_notas,
    p_productos,
    p_anticipo,
    p_fecha_creacion,
    'Anticipo',
    p_fecha_creacion
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Pagos, entregas y reembolsos atomicos.
-- ---------------------------------------------------------------------------

create or replace function public.guardar_pago_pedido(
  p_pedido_id uuid,
  p_pago_id uuid,
  p_monto numeric,
  p_metodo text,
  p_fecha date,
  p_notas text
) returns public.pagos
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_pedido public.pedidos%rowtype;
  v_pago public.pagos%rowtype;
begin
  if v_user is null then
    raise exception 'No autorizado';
  end if;

  select p.* into v_pedido
  from public.pedidos p
  where p.id = p_pedido_id
    and p.user_id = v_user
  for update;

  if not found then
    raise exception 'Pedido no encontrado';
  end if;

  if v_pedido.estado in ('Cancelado', 'Devuelto', 'Entregado') then
    raise exception 'Este pedido ya no permite modificar pagos';
  end if;

  if p_monto is null or p_monto <= 0 or p_monto = 'NaN'::numeric then
    raise exception 'El pago debe ser mayor a cero';
  end if;

  if trim(coalesce(p_metodo, '')) = '' or p_fecha is null then
    raise exception 'Selecciona el metodo y la fecha del pago';
  end if;

  if p_pago_id is null then
    insert into public.pagos (
      user_id, pedido_id, monto, metodo_pago, fecha_pago, notas, tipo
    ) values (
      v_user,
      p_pedido_id,
      round(p_monto, 2),
      trim(p_metodo),
      p_fecha,
      trim(coalesce(p_notas, '')),
      'pago'
    ) returning * into v_pago;
  else
    update public.pagos pg
    set monto = round(p_monto, 2),
        metodo_pago = trim(p_metodo),
        fecha_pago = p_fecha,
        notas = trim(coalesce(p_notas, ''))
    where pg.id = p_pago_id
      and pg.pedido_id = p_pedido_id
      and pg.user_id = v_user
    returning pg.* into v_pago;

    if not found then
      raise exception 'Pago no encontrado';
    end if;
  end if;

  return v_pago;
end;
$$;

create or replace function public.eliminar_pago_pedido(
  p_pago_id uuid
) returns public.pedidos
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_pago public.pagos%rowtype;
  v_pedido public.pedidos%rowtype;
begin
  if v_user is null then
    raise exception 'No autorizado';
  end if;

  select pg.* into v_pago
  from public.pagos pg
  join public.pedidos p on p.id = pg.pedido_id
  where pg.id = p_pago_id
    and pg.user_id = v_user
    and p.user_id = v_user;

  if not found then
    raise exception 'Pago no encontrado';
  end if;

  select p.* into v_pedido
  from public.pedidos p
  where p.id = v_pago.pedido_id
  for update;

  if v_pedido.estado in ('Cancelado', 'Devuelto', 'Entregado') then
    raise exception 'Este pedido ya no permite modificar pagos';
  end if;

  delete from public.pagos pg
  where pg.id = v_pago.id;

  return public.ordely_recalcular_totales_pedido_interno(v_pago.pedido_id);
end;
$$;

create or replace function public.entregar_pedido_completo(
  p_pedido_id uuid,
  p_metodo text,
  p_fecha date
) returns public.pedidos
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_pedido public.pedidos%rowtype;
  v_restante numeric;
  v_ahora timestamptz := now();
begin
  if v_user is null then
    raise exception 'No autorizado';
  end if;

  select p.* into v_pedido
  from public.pedidos p
  where p.id = p_pedido_id
    and p.user_id = v_user
  for update;

  if not found then
    raise exception 'Pedido no encontrado';
  end if;

  if v_pedido.estado in ('Cancelado', 'Devuelto') then
    raise exception 'Un pedido cancelado o devuelto no se puede entregar';
  end if;

  v_pedido := public.ordely_recalcular_totales_pedido_interno(p_pedido_id);
  v_restante := greatest(coalesce(v_pedido.restante, 0), 0);

  if v_pedido.estado = 'Entregado' and v_restante = 0 then
    return v_pedido;
  end if;

  if not exists (
    select 1 from public.productos_pedido pp
    where pp.pedido_id = p_pedido_id
      and pp.user_id = v_user
  ) then
    raise exception 'El pedido no tiene productos';
  end if;

  if v_restante > 0 then
    if trim(coalesce(p_metodo, '')) = '' or p_fecha is null then
      raise exception 'Selecciona el metodo y la fecha del pago de entrega';
    end if;

    insert into public.pagos (
      user_id, pedido_id, monto, metodo_pago, fecha_pago, notas, tipo
    ) values (
      v_user,
      p_pedido_id,
      v_restante,
      trim(p_metodo),
      p_fecha,
      'Pago restante al entregar pedido [entrega-pedido:' || p_pedido_id || ']',
      'pago'
    );
  end if;

  update public.productos_pedido pp
  set entregado = true,
      entregado_en = coalesce(pp.entregado_en, v_ahora),
      pagado_cliente = true,
      pagado_en = coalesce(pp.pagado_en, v_ahora),
      estado_compra = 'Entregado',
      fecha_recibido = coalesce(pp.fecha_recibido, v_ahora),
      fecha_entregado_cliente = coalesce(pp.fecha_entregado_cliente, v_ahora)
  where pp.pedido_id = p_pedido_id
    and pp.user_id = v_user;

  v_pedido := public.ordely_recalcular_totales_pedido_interno(p_pedido_id);

  update public.pedidos p
  set estado = 'Entregado',
      fecha_entregado = coalesce(p.fecha_entregado, v_ahora),
      reembolso = false,
      reembolso_monto = 0
  where p.id = p_pedido_id
  returning p.* into v_pedido;

  return v_pedido;
end;
$$;

create or replace function public.entregar_producto_pedido(
  p_producto_id uuid,
  p_metodo text,
  p_fecha date
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_producto public.productos_pedido%rowtype;
  v_pedido public.pedidos%rowtype;
  v_pagado numeric := 0;
  v_entregado_previo numeric := 0;
  v_total_producto numeric := 0;
  v_disponible numeric := 0;
  v_monto numeric := 0;
  v_ahora timestamptz := now();
begin
  if v_user is null then
    raise exception 'No autorizado';
  end if;

  select pp.* into v_producto
  from public.productos_pedido pp
  join public.pedidos p on p.id = pp.pedido_id
  where pp.id = p_producto_id
    and pp.user_id = v_user
    and p.user_id = v_user
  for update of pp;

  if not found then
    raise exception 'Producto no encontrado';
  end if;

  select p.* into v_pedido
  from public.pedidos p
  where p.id = v_producto.pedido_id
  for update;

  if v_pedido.estado in ('Cancelado', 'Devuelto') then
    raise exception 'Un pedido cancelado o devuelto no se puede entregar';
  end if;

  if coalesce(v_producto.entregado, false)
     or v_producto.estado_compra = 'Entregado' then
    return jsonb_build_object(
      'producto', to_jsonb(v_producto),
      'pedido', to_jsonb(v_pedido),
      'monto_cobrado', 0
    );
  end if;

  v_pedido := public.ordely_recalcular_totales_pedido_interno(v_pedido.id);

  select coalesce(sum(pg.monto), 0)
  into v_pagado
  from public.pagos pg
  where pg.pedido_id = v_pedido.id
    and pg.user_id = v_user;

  select coalesce(sum(coalesce(pp.precio_venta, 0) * coalesce(pp.cantidad, 0)), 0)
  into v_entregado_previo
  from public.productos_pedido pp
  where pp.pedido_id = v_pedido.id
    and pp.user_id = v_user
    and pp.id <> v_producto.id
    and coalesce(pp.entregado, false);

  v_total_producto := round(
    coalesce(v_producto.precio_venta, 0) * coalesce(v_producto.cantidad, 0),
    2
  );
  v_disponible := greatest(v_pagado - v_entregado_previo, 0);
  v_monto := round(least(
    greatest(v_total_producto - v_disponible, 0),
    greatest(coalesce(v_pedido.total_cliente, 0) - v_pagado, 0)
  ), 2);

  if v_monto > 0 then
    if trim(coalesce(p_metodo, '')) = '' or p_fecha is null then
      raise exception 'Selecciona el metodo y la fecha del pago';
    end if;

    insert into public.pagos (
      user_id, pedido_id, monto, metodo_pago, fecha_pago, notas, tipo
    ) values (
      v_user,
      v_pedido.id,
      v_monto,
      trim(p_metodo),
      p_fecha,
      'Pago al entregar producto [producto:' || v_producto.id || ']',
      'pago'
    );
  end if;

  update public.productos_pedido pp
  set entregado = true,
      entregado_en = coalesce(pp.entregado_en, v_ahora),
      pagado_cliente = true,
      pagado_en = coalesce(pp.pagado_en, v_ahora),
      estado_compra = 'Entregado',
      fecha_recibido = coalesce(pp.fecha_recibido, v_ahora),
      fecha_entregado_cliente = coalesce(pp.fecha_entregado_cliente, v_ahora)
  where pp.id = v_producto.id
  returning pp.* into v_producto;

  v_pedido := public.ordely_recalcular_totales_pedido_interno(v_pedido.id);

  if not exists (
    select 1
    from public.productos_pedido pp
    where pp.pedido_id = v_pedido.id
      and pp.user_id = v_user
      and (
        coalesce(pp.entregado, false) = false
        or coalesce(pp.estado_compra, '') <> 'Entregado'
      )
  ) then
    update public.pedidos p
    set estado = 'Entregado',
        fecha_entregado = coalesce(p.fecha_entregado, v_ahora),
        reembolso = false,
        reembolso_monto = 0
    where p.id = v_pedido.id
    returning p.* into v_pedido;
  end if;

  return jsonb_build_object(
    'producto', to_jsonb(v_producto),
    'pedido', to_jsonb(v_pedido),
    'monto_cobrado', v_monto
  );
end;
$$;

create or replace function public.registrar_reembolso_pedido(
  p_pedido_id uuid,
  p_estado text,
  p_monto numeric
) returns public.pedidos
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_pedido public.pedidos%rowtype;
  v_monto numeric := round(coalesce(p_monto, 0), 2);
begin
  if v_user is null then
    raise exception 'No autorizado';
  end if;

  if p_estado not in ('Cancelado', 'Devuelto') then
    raise exception 'Estado de reembolso no valido';
  end if;

  select p.* into v_pedido
  from public.pedidos p
  where p.id = p_pedido_id
    and p.user_id = v_user
  for update;

  if not found then
    raise exception 'Pedido no encontrado';
  end if;

  v_pedido := public.ordely_recalcular_totales_pedido_interno(p_pedido_id);

  if v_monto < 0 or v_monto = 'NaN'::numeric then
    raise exception 'El reembolso no puede ser negativo';
  end if;

  if v_monto > coalesce(v_pedido.anticipo, 0) then
    raise exception 'El reembolso no puede superar lo pagado por el cliente';
  end if;

  if p_estado = 'Devuelto' and v_pedido.estado <> 'Entregado' then
    raise exception 'Solo un pedido entregado puede marcarse como devuelto';
  end if;

  update public.pedidos p
  set estado = p_estado,
      reembolso = true,
      reembolso_monto = v_monto
  where p.id = p_pedido_id
  returning p.* into v_pedido;

  return v_pedido;
end;
$$;

-- Entregado solo se permite mediante las funciones atomicas anteriores.
create or replace function public.actualizar_estado_producto_logistica(
  p_producto_id uuid,
  p_estado text
) returns public.productos_pedido
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_producto public.productos_pedido%rowtype;
  v_estado text := trim(coalesce(p_estado, ''));
begin
  if auth.uid() is null then
    raise exception 'No autorizado';
  end if;

  select pp.* into v_producto
  from public.productos_pedido pp
  join public.pedidos p on p.id = pp.pedido_id
  where pp.id = p_producto_id
    and pp.user_id = auth.uid()
    and p.user_id = auth.uid()
  for update of pp;

  if not found then
    raise exception 'Producto no encontrado';
  end if;

  if v_estado = 'Recibido' then
    update public.productos_pedido pp
    set estado_compra = 'Recibido',
        fecha_recibido = coalesce(pp.fecha_recibido, now())
    where pp.id = p_producto_id
    returning pp.* into v_producto;
  elsif v_estado = 'Dejado en negocio' then
    update public.productos_pedido pp
    set estado_compra = 'Dejado en negocio',
        fecha_recibido = coalesce(pp.fecha_recibido, now()),
        fecha_dejado_negocio = coalesce(pp.fecha_dejado_negocio, now())
    where pp.id = p_producto_id
    returning pp.* into v_producto;
  else
    raise exception 'Estado logistico no valido';
  end if;

  if not exists (
    select 1 from public.productos_pedido pp
    where pp.pedido_id = v_producto.pedido_id
      and coalesce(pp.estado_compra, 'Pendiente de compra')
          not in ('Dejado en negocio', 'Entregado')
  ) then
    update public.pedidos p
    set estado = 'Dejado en negocio',
        fecha_dejado_negocio = coalesce(p.fecha_dejado_negocio, now())
    where p.id = v_producto.pedido_id
      and p.estado not in ('Cancelado', 'Devuelto', 'Entregado');
  elsif not exists (
    select 1 from public.productos_pedido pp
    where pp.pedido_id = v_producto.pedido_id
      and coalesce(pp.estado_compra, 'Pendiente de compra')
          not in ('Recibido', 'Dejado en negocio', 'Entregado')
  ) then
    update public.pedidos p
    set estado = 'Recibido',
        fecha_recibido = coalesce(p.fecha_recibido, now())
    where p.id = v_producto.pedido_id
      and p.estado not in ('Cancelado', 'Devuelto', 'Entregado', 'Dejado en negocio');
  end if;

  return v_producto;
end;
$$;

-- ---------------------------------------------------------------------------
-- Compra atomica con bloqueo de productos y reparto exacto de centavos.
-- El ultimo producto absorbe el residuo de cada concepto para que los totales
-- del lote y la suma de sus productos coincidan.
-- ---------------------------------------------------------------------------

create or replace function public.crear_lote_compra(
  p_plataforma text,
  p_numero_orden text,
  p_cupon text,
  p_descuento_cupon numeric,
  p_puntos numeric,
  p_envio numeric,
  p_importacion numeric,
  p_impuestos numeric,
  p_comisiones numeric,
  p_total_pagado numeric,
  p_fecha_compra date,
  p_productos uuid[]
) returns public.lotes_compra
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_lote public.lotes_compra%rowtype;
  v_producto public.productos_pedido%rowtype;
  v_pedido_id uuid;
  v_plataforma text := coalesce(nullif(trim(p_plataforma), ''), 'SHEIN');
  v_codigo text;
  v_prefijo text;
  v_fecha date := coalesce(p_fecha_compra, current_date);
  v_fecha_ts timestamptz;
  v_dias integer;
  v_productos_count integer := 0;
  v_elegibles_count integer := 0;
  v_indice integer := 0;
  v_indice_elegible integer := 0;
  v_subtotal numeric := 0;
  v_subtotal_elegible numeric := 0;
  v_descuento_cupon numeric := greatest(coalesce(p_descuento_cupon, 0), 0);
  v_puntos numeric := greatest(coalesce(p_puntos, 0), 0);
  v_descuento_total numeric := 0;
  v_envio numeric := greatest(coalesce(p_envio, 0), 0);
  v_importacion numeric := greatest(coalesce(p_importacion, 0), 0);
  v_impuestos numeric := greatest(coalesce(p_impuestos, 0), 0);
  v_comisiones numeric := greatest(coalesce(p_comisiones, 0), 0);
  v_costos_extra numeric := 0;
  v_total_productos_descuento numeric := 0;
  v_total_calculado numeric := 0;
  v_total_efectivo numeric := 0;
  v_subtotal_producto numeric := 0;
  v_factor numeric := 0;
  v_descuento_producto numeric := 0;
  v_puntos_producto numeric := 0;
  v_envio_producto numeric := 0;
  v_importacion_producto numeric := 0;
  v_impuesto_producto numeric := 0;
  v_comision_producto numeric := 0;
  v_descuento_asignado numeric := 0;
  v_puntos_asignados numeric := 0;
  v_envio_asignado numeric := 0;
  v_importacion_asignada numeric := 0;
  v_impuestos_asignados numeric := 0;
  v_comisiones_asignadas numeric := 0;
  v_costo_total numeric := 0;
  v_costo_unitario numeric := 0;
  v_ganancia numeric := 0;
begin
  if v_user is null then
    raise exception 'No autorizado';
  end if;

  if p_productos is null or cardinality(p_productos) = 0 then
    raise exception 'Selecciona productos para registrar la compra';
  end if;

  if coalesce(p_descuento_cupon, 0) = 'NaN'::numeric
     or coalesce(p_puntos, 0) = 'NaN'::numeric
     or coalesce(p_envio, 0) = 'NaN'::numeric
     or coalesce(p_importacion, 0) = 'NaN'::numeric
     or coalesce(p_impuestos, 0) = 'NaN'::numeric
     or coalesce(p_comisiones, 0) = 'NaN'::numeric
     or coalesce(p_total_pagado, 0) = 'NaN'::numeric
     or coalesce(p_descuento_cupon, 0) < 0
     or coalesce(p_puntos, 0) < 0
     or coalesce(p_envio, 0) < 0
     or coalesce(p_importacion, 0) < 0
     or coalesce(p_impuestos, 0) < 0
     or coalesce(p_comisiones, 0) < 0
     or coalesce(p_total_pagado, 0) < 0 then
    raise exception 'Los importes de la compra no son validos';
  end if;

  -- Serializa compras que intenten utilizar el mismo producto.
  perform pp.id
  from public.productos_pedido pp
  join public.pedidos p on p.id = pp.pedido_id
  where pp.id = any(p_productos)
    and pp.user_id = v_user
    and p.user_id = v_user
  order by pp.id
  for update of pp;

  select
    count(*)::integer,
    count(*) filter (where coalesce(pp.participa_cupon, true))::integer,
    coalesce(sum(coalesce(pp.precio_pagina, pp.precio_shein, 0) * pp.cantidad), 0),
    coalesce(sum(
      coalesce(pp.precio_pagina, pp.precio_shein, 0) * pp.cantidad
    ) filter (where coalesce(pp.participa_cupon, true)), 0)
  into v_productos_count, v_elegibles_count, v_subtotal, v_subtotal_elegible
  from public.productos_pedido pp
  join public.pedidos p on p.id = pp.pedido_id
  where pp.id = any(p_productos)
    and pp.user_id = v_user
    and p.user_id = v_user
    and pp.lote_compra_id is null
    and p.estado not in ('Cancelado', 'Devuelto', 'Entregado');

  if v_productos_count <> cardinality(p_productos) then
    raise exception 'Hay productos repetidos, inexistentes, cerrados o ya incluidos en otra compra';
  end if;

  if v_subtotal <= 0 then
    raise exception 'No hay subtotal valido para la compra';
  end if;

  v_descuento_cupon := least(v_descuento_cupon, v_subtotal_elegible);
  v_puntos := least(v_puntos, greatest(v_subtotal_elegible - v_descuento_cupon, 0));
  v_descuento_total := round(v_descuento_cupon + v_puntos, 2);
  v_costos_extra := round(v_envio + v_importacion + v_impuestos + v_comisiones, 2);
  v_total_productos_descuento := round(greatest(v_subtotal - v_descuento_total, 0), 2);
  v_total_calculado := round(v_total_productos_descuento + v_costos_extra, 2);

  if coalesce(p_total_pagado, 0) > 0
     and abs(round(p_total_pagado, 2) - v_total_calculado) > 0.009 then
    raise exception 'El total pagado no coincide con el desglose de la compra';
  end if;

  v_total_efectivo := case
    when coalesce(p_total_pagado, 0) > 0 then round(p_total_pagado, 2)
    else v_total_calculado
  end;

  v_prefijo := case
    when lower(v_plataforma) like '%shein%' then 'SHE'
    when lower(v_plataforma) like '%temu%' then 'TEM'
    when lower(v_plataforma) like '%ali%' then 'ALI'
    when lower(v_plataforma) like '%tiktok%' then 'TTS'
    when lower(v_plataforma) like '%mercado%' then 'ML'
    when lower(v_plataforma) like '%amazon%' then 'AMZ'
    when lower(v_plataforma) like '%cat%' then 'CAT'
    else 'OTR'
  end;

  v_codigo := v_prefijo || '-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISSMS')
    || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));

  insert into public.lotes_compra (
    user_id,
    codigo_lote,
    plataforma,
    numero_orden_plataforma,
    cupon_usado,
    subtotal_pagina,
    descuento_cupon,
    puntos_total,
    descuento_total,
    envio,
    importacion,
    impuestos,
    comisiones,
    total_productos_con_descuento,
    costos_extra_total,
    total_pagado,
    ahorro_total,
    fecha_compra
  ) values (
    v_user,
    v_codigo,
    v_plataforma,
    trim(coalesce(p_numero_orden, '')),
    upper(trim(coalesce(p_cupon, ''))),
    round(v_subtotal, 2),
    v_descuento_cupon,
    v_puntos,
    v_descuento_total,
    v_envio,
    v_importacion,
    v_impuestos,
    v_comisiones,
    v_total_productos_descuento,
    v_costos_extra,
    v_total_efectivo,
    v_descuento_total,
    v_fecha
  ) returning * into v_lote;

  v_dias := public.obtener_dias_estimados_plataforma(v_user, v_plataforma);
  v_fecha_ts := make_timestamptz(
    extract(year from v_fecha)::integer,
    extract(month from v_fecha)::integer,
    extract(day from v_fecha)::integer,
    12, 0, 0,
    'America/Mexico_City'
  );

  for v_producto in
    select pp.*
    from public.productos_pedido pp
    where pp.id = any(p_productos)
      and pp.user_id = v_user
      and pp.lote_compra_id is null
    order by pp.id
  loop
    v_indice := v_indice + 1;
    v_subtotal_producto := round(
      coalesce(v_producto.precio_pagina, v_producto.precio_shein, 0)
      * v_producto.cantidad,
      2
    );
    v_factor := v_subtotal_producto / v_subtotal;

    if coalesce(v_producto.participa_cupon, true) and v_elegibles_count > 0 then
      v_indice_elegible := v_indice_elegible + 1;
      if v_indice_elegible = v_elegibles_count then
        v_descuento_producto := round(v_descuento_cupon - v_descuento_asignado, 2);
        v_puntos_producto := round(v_puntos - v_puntos_asignados, 2);
      else
        v_descuento_producto := round(
          v_descuento_cupon * (v_subtotal_producto / v_subtotal_elegible),
          2
        );
        v_puntos_producto := round(
          v_puntos * (v_subtotal_producto / v_subtotal_elegible),
          2
        );
      end if;
    else
      v_descuento_producto := 0;
      v_puntos_producto := 0;
    end if;

    if v_indice = v_productos_count then
      v_envio_producto := round(v_envio - v_envio_asignado, 2);
      v_importacion_producto := round(v_importacion - v_importacion_asignada, 2);
      v_impuesto_producto := round(v_impuestos - v_impuestos_asignados, 2);
      v_comision_producto := round(v_comisiones - v_comisiones_asignadas, 2);
    else
      v_envio_producto := round(v_envio * v_factor, 2);
      v_importacion_producto := round(v_importacion * v_factor, 2);
      v_impuesto_producto := round(v_impuestos * v_factor, 2);
      v_comision_producto := round(v_comisiones * v_factor, 2);
    end if;

    v_descuento_asignado := v_descuento_asignado + v_descuento_producto;
    v_puntos_asignados := v_puntos_asignados + v_puntos_producto;
    v_envio_asignado := v_envio_asignado + v_envio_producto;
    v_importacion_asignada := v_importacion_asignada + v_importacion_producto;
    v_impuestos_asignados := v_impuestos_asignados + v_impuesto_producto;
    v_comisiones_asignadas := v_comisiones_asignadas + v_comision_producto;

    v_costo_total := round(greatest(
      v_subtotal_producto - v_descuento_producto - v_puntos_producto,
      0
    ), 2);
    v_costo_unitario := round(v_costo_total / v_producto.cantidad, 2);
    v_ganancia := round(
      coalesce(v_producto.precio_venta, 0) * v_producto.cantidad - v_costo_total,
      2
    );

    insert into public.lote_productos (
      lote_id,
      producto_pedido_id,
      pedido_id,
      precio_pagina_unitario,
      cantidad,
      subtotal_pagina,
      participa_cupon,
      descuento_asignado,
      puntos_asignados,
      envio_asignado,
      importacion_asignada,
      impuesto_asignado,
      comision_asignada,
      costo_real_total,
      costo_real_unitario,
      ganancia_total
    ) values (
      v_lote.id,
      v_producto.id,
      v_producto.pedido_id,
      coalesce(v_producto.precio_pagina, v_producto.precio_shein, 0),
      v_producto.cantidad,
      v_subtotal_producto,
      coalesce(v_producto.participa_cupon, true),
      v_descuento_producto,
      v_puntos_producto,
      v_envio_producto,
      v_importacion_producto,
      v_impuesto_producto,
      v_comision_producto,
      v_costo_total,
      v_costo_unitario,
      v_ganancia
    );

    update public.productos_pedido pp
    set lote_compra_id = v_lote.id,
        precio_shein = v_costo_unitario,
        costo_real_unitario = v_costo_unitario,
        costo_real_total = v_costo_total,
        ganancia_real = v_ganancia,
        descuento_asignado = v_descuento_producto,
        puntos_asignados = v_puntos_producto,
        envio_asignado = v_envio_producto,
        importacion_asignada = v_importacion_producto,
        impuesto_asignado = v_impuesto_producto,
        comision_asignada = v_comision_producto,
        estado_compra = 'En camino',
        fecha_comprado = v_fecha_ts,
        fecha_estimada_llegada = v_fecha + v_dias
    where pp.id = v_producto.id;
  end loop;

  for v_pedido_id in
    select distinct lp.pedido_id
    from public.lote_productos lp
    where lp.lote_id = v_lote.id
  loop
    perform public.ordely_recalcular_totales_pedido_interno(v_pedido_id);

    if not exists (
      select 1
      from public.productos_pedido pp
      where pp.pedido_id = v_pedido_id
        and coalesce(pp.estado_compra, 'Pendiente de compra') = 'Pendiente de compra'
    ) then
      update public.pedidos p
      set estado = case
            when p.estado in ('Cancelado', 'Devuelto', 'Entregado') then p.estado
            else 'En camino'
          end,
          fecha_comprado = coalesce(p.fecha_comprado, v_fecha_ts)
      where p.id = v_pedido_id;
    end if;
  end loop;

  return v_lote;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: cada fila hija debe coincidir tambien con el dueño de su registro padre.
-- auth.uid() se evalua una vez por consulta para evitar los avisos initplan.
-- ---------------------------------------------------------------------------

drop policy if exists pedidos_select_own on public.pedidos;
drop policy if exists pedidos_insert_own on public.pedidos;
drop policy if exists pedidos_update_own on public.pedidos;
drop policy if exists pedidos_delete_own on public.pedidos;

create policy pedidos_select_own on public.pedidos
for select to authenticated
using ((select auth.uid()) = user_id);

create policy pedidos_insert_own on public.pedidos
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    cliente_id is null
    or exists (
      select 1 from public.clientes c
      where c.id = pedidos.cliente_id
        and c.user_id = (select auth.uid())
    )
  )
);

create policy pedidos_update_own on public.pedidos
for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (
    cliente_id is null
    or exists (
      select 1 from public.clientes c
      where c.id = pedidos.cliente_id
        and c.user_id = (select auth.uid())
    )
  )
);

create policy pedidos_delete_own on public.pedidos
for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists productos_select_own on public.productos_pedido;
drop policy if exists productos_insert_own on public.productos_pedido;
drop policy if exists productos_update_own on public.productos_pedido;
drop policy if exists productos_delete_own on public.productos_pedido;

create policy productos_select_own on public.productos_pedido
for select to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.pedidos p
    where p.id = productos_pedido.pedido_id
      and p.user_id = (select auth.uid())
  )
);

create policy productos_insert_own on public.productos_pedido
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.pedidos p
    where p.id = productos_pedido.pedido_id
      and p.user_id = (select auth.uid())
  )
);

create policy productos_update_own on public.productos_pedido
for update to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.pedidos p
    where p.id = productos_pedido.pedido_id
      and p.user_id = (select auth.uid())
  )
)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.pedidos p
    where p.id = productos_pedido.pedido_id
      and p.user_id = (select auth.uid())
  )
);

create policy productos_delete_own on public.productos_pedido
for delete to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.pedidos p
    where p.id = productos_pedido.pedido_id
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists pagos_select_own on public.pagos;
drop policy if exists pagos_insert_own on public.pagos;
drop policy if exists pagos_update_own on public.pagos;
drop policy if exists pagos_delete_own on public.pagos;

create policy pagos_select_own on public.pagos
for select to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.pedidos p
    where p.id = pagos.pedido_id
      and p.user_id = (select auth.uid())
  )
);

create policy pagos_insert_own on public.pagos
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.pedidos p
    where p.id = pagos.pedido_id
      and p.user_id = (select auth.uid())
  )
);

create policy pagos_update_own on public.pagos
for update to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.pedidos p
    where p.id = pagos.pedido_id
      and p.user_id = (select auth.uid())
  )
)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.pedidos p
    where p.id = pagos.pedido_id
      and p.user_id = (select auth.uid())
  )
);

create policy pagos_delete_own on public.pagos
for delete to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.pedidos p
    where p.id = pagos.pedido_id
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists "Usuarios ven productos de sus lotes" on public.lote_productos;
drop policy if exists lote_productos_own on public.lote_productos;

create policy lote_productos_own on public.lote_productos
for all to authenticated
using (
  exists (
    select 1
    from public.lotes_compra lc
    join public.productos_pedido pp
      on pp.id = lote_productos.producto_pedido_id
    join public.pedidos p
      on p.id = lote_productos.pedido_id
    where lc.id = lote_productos.lote_id
      and lc.user_id = (select auth.uid())
      and pp.user_id = (select auth.uid())
      and pp.pedido_id = p.id
      and p.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.lotes_compra lc
    join public.productos_pedido pp
      on pp.id = lote_productos.producto_pedido_id
    join public.pedidos p
      on p.id = lote_productos.pedido_id
    where lc.id = lote_productos.lote_id
      and lc.user_id = (select auth.uid())
      and pp.user_id = (select auth.uid())
      and pp.pedido_id = p.id
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists "Usuarios ven sus lotes" on public.lotes_compra;
drop policy if exists lotes_compra_own on public.lotes_compra;
create policy lotes_compra_own on public.lotes_compra
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Permisos. Solo el seguimiento por token sigue siendo anonimo.
-- ---------------------------------------------------------------------------

do $$
declare
  v_funcion record;
begin
  for v_funcion in
    select p.oid::regprocedure::text as firma
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format(
      'revoke execute on function %s from public, anon',
      v_funcion.firma
    );
  end loop;
end;
$$;

grant execute on function public.public_obtener_seguimiento(uuid) to anon, authenticated;
revoke execute on function public.estado_correo_registro(text) from anon, authenticated;
revoke execute on function public.correo_ya_registrado(text) from anon, authenticated;

grant execute on function public.actualizar_mi_plataforma(text) to authenticated;
grant execute on function public.actualizar_estado_producto_logistica(uuid, text) to authenticated;
grant execute on function public.mi_estado_plan() to authenticated;
grant execute on function public.recalcular_totales_pedido(uuid) to authenticated;
grant execute on function public.crear_pedido_completo(uuid, text, text, text, text, jsonb, numeric, date) to authenticated;
grant execute on function public.crear_pedido_completo(uuid, text, text, text, text, jsonb, numeric, date, text, date) to authenticated;
grant execute on function public.crear_lote_compra(text, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, date, uuid[]) to authenticated;
grant execute on function public.guardar_pago_pedido(uuid, uuid, numeric, text, date, text) to authenticated;
grant execute on function public.eliminar_pago_pedido(uuid) to authenticated;
grant execute on function public.entregar_pedido_completo(uuid, text, date) to authenticated;
grant execute on function public.entregar_producto_pedido(uuid, text, date) to authenticated;
grant execute on function public.registrar_reembolso_pedido(uuid, text, numeric) to authenticated;

-- Estas altas solo son validas a traves de sus RPC atomicas. Las lecturas y
-- las demas operaciones que usa la interfaz conservan sus permisos actuales.
revoke insert on table public.pedidos from anon, authenticated;
revoke insert, update, delete on table public.pagos from anon, authenticated;
revoke insert, update, delete on table public.lotes_compra from anon, authenticated;
revoke insert, update, delete on table public.lote_productos from anon, authenticated;
revoke execute on function public.generar_codigo_pedido(text) from anon, authenticated;

revoke all on function public.ordely_recalcular_totales_pedido_interno(uuid)
  from public, anon, authenticated;
revoke all on function public.ordely_validar_pedido_integridad()
  from public, anon, authenticated;
revoke all on function public.ordely_validar_producto_integridad()
  from public, anon, authenticated;
revoke all on function public.ordely_recalcular_por_producto()
  from public, anon, authenticated;
revoke all on function public.ordely_validar_pago_integridad()
  from public, anon, authenticated;
revoke all on function public.ordely_recalcular_por_pago()
  from public, anon, authenticated;
revoke all on function public.ordely_validar_lote_producto_integridad()
  from public, anon, authenticated;
revoke all on function public.ordely_validar_lote_integridad()
  from public, anon, authenticated;
revoke all on function public.bloquear_crear_pedido_si_limite()
  from public, anon, authenticated;
revoke all on function public.registrar_intento_pedido_creado()
  from public, anon, authenticated;
revoke all on function public.ordely_validar_creacion_nueva()
  from public, anon, authenticated;
revoke all on function public.ordely_sincronizar_pedidos_usados()
  from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon;

commit;
