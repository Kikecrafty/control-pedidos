\set ON_ERROR_STOP on

begin;

set local role supabase_auth_admin;
insert into auth.users(id, email, created_at, updated_at)
values ('33333333-3333-4333-8333-333333333333', 'compra-manual@ordely.test', now(), now());
reset role;

insert into public.perfiles(user_id, nombre, correo, plan_actual, limite_pedidos)
values (
  '33333333-3333-4333-8333-333333333333',
  'Compra manual',
  'compra-manual@ordely.test',
  'pro',
  999999
);

insert into public.clientes(id, user_id, nombre)
values (
  'bbbbbbbb-3333-4333-8333-333333333333',
  '33333333-3333-4333-8333-333333333333',
  'Cliente compra manual'
);

select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
set local role authenticated;

do $$
declare
  v_pedido uuid;
  v_producto_uno uuid;
  v_producto_dos uuid;
  v_lote public.lotes_compra%rowtype;
  v_numero numeric;
begin
  v_pedido := (public.crear_pedido_completo(
    'bbbbbbbb-3333-4333-8333-333333333333',
    'SHEIN',
    'Cotizado',
    '',
    'Prueba de costos manuales',
    '[
      {"nombre_producto":"Manual uno","cantidad":2,"precio_pagina":50,"precio_venta":80},
      {"nombre_producto":"Manual dos","cantidad":1,"precio_pagina":200,"precio_venta":250}
    ]'::jsonb,
    0,
    date '2026-07-15',
    'Efectivo',
    date '2026-07-15'
  ) ->> 'id')::uuid;

  select id into v_producto_uno
  from public.productos_pedido
  where pedido_id = v_pedido and nombre_producto = 'Manual uno';

  select id into v_producto_dos
  from public.productos_pedido
  where pedido_id = v_pedido and nombre_producto = 'Manual dos';

  v_lote := public.crear_lote_compra_costos_manuales_v1(
    'SHEIN',
    'ORDEN-MANUAL-1',
    'CUPON-CARRITO · COSTOS MANUALES',
    10,
    5,
    5,
    4.50,
    250,
    date '2026-07-15',
    jsonb_build_array(
      jsonb_build_object('producto_id', v_producto_uno, 'costo_total', 70),
      jsonb_build_object('producto_id', v_producto_dos, 'costo_total', 155.50)
    )
  );

  if v_lote.subtotal_pagina <> 300
     or v_lote.descuento_total <> 74.50
     or v_lote.total_productos_con_descuento <> 225.50
     or v_lote.costos_extra_total <> 24.50
     or v_lote.total_pagado <> 250 then
    raise exception 'Fallo: el resumen del lote manual es incorrecto';
  end if;

  select sum(costo_real_total) into v_numero
  from public.lote_productos
  where lote_id = v_lote.id;

  if v_numero <> 225.50 then
    raise exception 'Fallo: los costos manuales no se conservaron exactamente';
  end if;

  select sum(descuento_asignado) into v_numero
  from public.lote_productos
  where lote_id = v_lote.id;

  if v_numero <> 74.50 then
    raise exception 'Fallo: el ahorro manual no coincide con las lineas';
  end if;

  select sum(envio_asignado + importacion_asignada + impuesto_asignado + comision_asignada)
  into v_numero
  from public.lote_productos
  where lote_id = v_lote.id;

  if v_numero <> 24.50 then
    raise exception 'Fallo: los cargos no se repartieron al centavo';
  end if;

  if (select total_shein from public.pedidos where id = v_pedido) <> 225.50 then
    raise exception 'Fallo: el pedido no adopto los costos manuales';
  end if;

  if has_function_privilege(
    'anon',
    'public.crear_lote_compra_costos_manuales_v1(text,text,text,numeric,numeric,numeric,numeric,numeric,date,jsonb)',
    'execute'
  ) then
    raise exception 'Fallo: anon puede registrar compras manuales';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.crear_lote_compra_costos_manuales_v1(text,text,text,numeric,numeric,numeric,numeric,numeric,date,jsonb)',
    'execute'
  ) then
    raise exception 'Fallo: una cuenta autenticada no puede registrar compras manuales';
  end if;

  raise notice 'Prueba de costos manuales completada correctamente';
end;
$$;

rollback;

\echo 'OK: costos manuales por producto verificados'
