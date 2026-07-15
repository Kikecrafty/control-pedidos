-- Pruebas locales de integridad para Ordely v1.1.
-- Se ejecutan dentro de una transaccion y terminan con ROLLBACK.

begin;

set local role supabase_auth_admin;
insert into auth.users (id, email, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', 'ordely-test-1@example.invalid', now(), now()),
  ('22222222-2222-2222-2222-222222222222', 'ordely-test-2@example.invalid', now(), now());
reset role;

insert into public.perfiles (
  user_id, nombre, correo, plan_actual, limite_pedidos, periodo_inicia_en
) values
  (
    '11111111-1111-1111-1111-111111111111',
    'Prueba uno',
    'ordely-test-1@example.invalid',
    'basico',
    2,
    now() - interval '1 day'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Prueba dos',
    'ordely-test-2@example.invalid',
    'basico',
    30,
    now() - interval '1 day'
  );

insert into public.clientes (id, user_id, nombre)
values
  ('aaaaaaaa-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Cliente prueba uno'),
  ('aaaaaaaa-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Cliente prueba dos');

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;

do $$
declare
  v_pedido_1 uuid;
  v_pedido_2 uuid;
  v_productos_1 uuid[];
  v_productos_2 uuid[];
  v_lote public.lotes_compra%rowtype;
  v_pedido public.pedidos%rowtype;
  v_resultado jsonb;
  v_fallo_esperado boolean;
  v_numero numeric;
  v_codigo text;
  v_puede_crear boolean;
  v_puede_modificar boolean;
begin
  if exists (
    select 1 from public.clientes c
    where c.id = 'aaaaaaaa-2222-2222-2222-222222222222'
  ) then
    raise exception 'Fallo: RLS permitio leer un cliente de otra cuenta';
  end if;

  v_pedido_1 := (public.crear_pedido_completo(
    'aaaaaaaa-1111-1111-1111-111111111111',
    'SHEIN',
    'Cotizado',
    '',
    'Prueba automatizada',
    '[
      {"nombre_producto":"Producto A","cantidad":2,"precio_pagina":100,"precio_shein":80,"precio_venta":120},
      {"nombre_producto":"Producto B","cantidad":1,"precio_pagina":50,"precio_shein":50,"precio_venta":70}
    ]'::jsonb,
    100,
    date '2026-07-01',
    'Transferencia',
    date '2026-07-02'
  ) ->> 'id')::uuid;

  select p.codigo, p.total_shein, p.total_cliente, p.anticipo, p.restante, p.ganancia
  into v_codigo, v_pedido.total_shein, v_pedido.total_cliente,
       v_pedido.anticipo, v_pedido.restante, v_pedido.ganancia
  from public.pedidos p
  where p.id = v_pedido_1;

  if v_codigo <> 'SHN-1'
     or v_pedido.total_shein <> 210
     or v_pedido.total_cliente <> 310
     or v_pedido.anticipo <> 100
     or v_pedido.restante <> 210
     or v_pedido.ganancia <> 100 then
    raise exception 'Fallo: totales o folio inicial incorrectos';
  end if;

  if not exists (
    select 1 from public.pagos pg
    where pg.pedido_id = v_pedido_1
      and pg.monto = 100
      and pg.metodo_pago = 'Transferencia'
      and pg.fecha_pago = date '2026-07-02'
  ) then
    raise exception 'Fallo: anticipo y metadatos no quedaron atomicos';
  end if;

  select array_agg(pp.id order by pp.nombre_producto)
  into v_productos_1
  from public.productos_pedido pp
  where pp.pedido_id = v_pedido_1;

  v_lote := public.crear_lote_compra(
    'SHEIN',
    'ORDEN-PRUEBA-1',
    'CUPON-PRUEBA',
    30,
    20,
    7,
    3,
    2,
    1,
    213,
    date '2026-07-03',
    v_productos_1
  );

  select
    sum(lp.descuento_asignado + lp.puntos_asignados),
    sum(lp.envio_asignado + lp.importacion_asignada + lp.impuesto_asignado + lp.comision_asignada)
  into v_numero, v_pedido.ganancia
  from public.lote_productos lp
  where lp.lote_id = v_lote.id;

  if v_lote.total_pagado <> 213
     or v_numero <> 50
     or v_pedido.ganancia <> 13 then
    raise exception 'Fallo: reparto de descuentos o extras no coincide al centavo';
  end if;

  v_fallo_esperado := false;
  begin
    update public.productos_pedido
    set cantidad = cantidad + 1
    where id = v_productos_1[1];
  exception when others then
    v_fallo_esperado := true;
  end;

  if not v_fallo_esperado then
    raise exception 'Fallo: se permitio modificar el importe de un producto comprado';
  end if;

  v_fallo_esperado := false;
  begin
    perform public.guardar_pago_pedido(
      v_pedido_1, null, 211, 'Efectivo', date '2026-07-04', 'Sobrepago de prueba'
    );
  exception when others then
    v_fallo_esperado := true;
  end;

  if not v_fallo_esperado then
    raise exception 'Fallo: se permitio un pago superior al saldo';
  end if;

  v_pedido := public.entregar_pedido_completo(
    v_pedido_1, 'Efectivo', date '2026-07-05'
  );

  if v_pedido.estado <> 'Entregado'
     or v_pedido.anticipo <> 310
     or v_pedido.restante <> 0
     or v_pedido.total_shein <> 200
     or exists (
       select 1 from public.productos_pedido pp
       where pp.pedido_id = v_pedido_1
         and (
           not pp.entregado
           or not pp.pagado_cliente
           or pp.estado_compra <> 'Entregado'
         )
     ) then
    raise exception 'Fallo: entrega completa inconsistente';
  end if;

  v_pedido_2 := (public.crear_pedido_completo(
    'aaaaaaaa-1111-1111-1111-111111111111',
    'Temu',
    'Cotizado',
    '',
    '',
    '[
      {"nombre_producto":"Producto C","cantidad":2,"precio_pagina":100,"precio_shein":80,"precio_venta":120},
      {"nombre_producto":"Producto D","cantidad":1,"precio_pagina":50,"precio_shein":50,"precio_venta":70}
    ]'::jsonb,
    0,
    date '2026-07-06',
    'Efectivo',
    date '2026-07-06'
  ) ->> 'id')::uuid;

  select array_agg(pp.id order by pp.nombre_producto)
  into v_productos_2
  from public.productos_pedido pp
  where pp.pedido_id = v_pedido_2;

  v_resultado := public.entregar_producto_pedido(
    v_productos_2[1], 'Efectivo', date '2026-07-07'
  );
  if (v_resultado ->> 'monto_cobrado')::numeric <> 240 then
    raise exception 'Fallo: cobro del primer producto incorrecto';
  end if;

  v_resultado := public.entregar_producto_pedido(
    v_productos_2[2], 'Transferencia', date '2026-07-08'
  );
  if (v_resultado ->> 'monto_cobrado')::numeric <> 70 then
    raise exception 'Fallo: cobro del segundo producto incorrecto';
  end if;

  select p.* into v_pedido from public.pedidos p where p.id = v_pedido_2;
  if v_pedido.estado <> 'Entregado'
     or v_pedido.anticipo <> 310
     or v_pedido.restante <> 0
     or not exists (
       select 1 from public.pagos pg
       where pg.pedido_id = v_pedido_2
         and pg.notas like '%[producto:%'
     ) then
    raise exception 'Fallo: entrega por productos inconsistente';
  end if;

  v_fallo_esperado := false;
  begin
    insert into public.productos_pedido (
      user_id, pedido_id, nombre_producto, cantidad, precio_pagina, precio_shein, precio_venta
    ) values (
      '22222222-2222-2222-2222-222222222222',
      v_pedido_2,
      'Cruce de cuenta',
      1,
      10,
      10,
      10
    );
  exception when others then
    v_fallo_esperado := true;
  end;

  if not v_fallo_esperado then
    raise exception 'Fallo: se permitio relacionar producto y pedido de cuentas distintas';
  end if;

  select e.puede_crear_pedido, e.puede_modificar
  into v_puede_crear, v_puede_modificar
  from public.mi_estado_plan() e;

  if v_puede_crear or not v_puede_modificar then
    raise exception 'Fallo: el limite Basico no separa crear de modificar';
  end if;

  v_fallo_esperado := false;
  begin
    perform public.crear_pedido_completo(
      'aaaaaaaa-1111-1111-1111-111111111111',
      'Amazon',
      'Cotizado',
      '',
      '',
      '[{"nombre_producto":"Producto bloqueado","cantidad":1,"precio_pagina":10,"precio_venta":10}]'::jsonb,
      0,
      date '2026-07-09',
      'Efectivo',
      date '2026-07-09'
    );
  exception when others then
    v_fallo_esperado := true;
  end;

  if not v_fallo_esperado then
    raise exception 'Fallo: el Plan Basico excedio su limite';
  end if;

  if (select p.pedidos_usados from public.perfiles p
      where p.user_id = '11111111-1111-1111-1111-111111111111') <> 2 then
    raise exception 'Fallo: los intentos de pedido no quedaron sincronizados';
  end if;

  raise notice 'Pruebas de integridad Ordely v1.1 completadas correctamente';
end;
$$;

rollback;
