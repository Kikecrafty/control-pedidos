-- Ordely v1.1 - reparaciones deterministas para datos creados por versiones
-- anteriores. Ejecutar solamente despues de revisar y aplicar la migracion de
-- integridad 20260714170000_integridad_pedidos_v1_1.sql.

begin;

-- La accion antigua "Entregar pedido" actualizaba el pedido y podia dejar sus
-- productos sin las fechas/estados equivalentes. Se conserva la intencion que
-- ya quedo registrada en el pedido y se completa el estado de sus productos.
update public.productos_pedido pp
set entregado = true,
    entregado_en = coalesce(pp.entregado_en, p.fecha_entregado, now()),
    pagado_cliente = true,
    pagado_en = coalesce(pp.pagado_en, p.fecha_entregado, now()),
    estado_compra = 'Entregado',
    fecha_recibido = coalesce(pp.fecha_recibido, p.fecha_recibido, p.fecha_entregado, now()),
    fecha_entregado_cliente = coalesce(pp.fecha_entregado_cliente, p.fecha_entregado, now())
from public.pedidos p
where p.id = pp.pedido_id
  and p.user_id = pp.user_id
  and p.estado = 'Entregado'
  and (
    coalesce(pp.entregado, false) = false
    or coalesce(pp.pagado_cliente, false) = false
    or coalesce(pp.estado_compra, '') <> 'Entregado'
    or pp.fecha_entregado_cliente is null
  );

-- Algunas entregas por producto solo actualizaron los booleanos.
update public.productos_pedido pp
set estado_compra = 'Entregado',
    entregado_en = coalesce(pp.entregado_en, pp.fecha_entregado_cliente, now()),
    pagado_cliente = true,
    pagado_en = coalesce(pp.pagado_en, pp.fecha_entregado_cliente, now()),
    fecha_recibido = coalesce(pp.fecha_recibido, pp.fecha_entregado_cliente, now()),
    fecha_entregado_cliente = coalesce(pp.fecha_entregado_cliente, pp.entregado_en, now())
where coalesce(pp.entregado, false)
  and (
    coalesce(pp.estado_compra, '') <> 'Entregado'
    or coalesce(pp.pagado_cliente, false) = false
    or pp.fecha_entregado_cliente is null
  );

-- Completa las columnas agregadas en lotes modernos usando el desglose que ya
-- estaba almacenado. No cambia el total pagado ni inventa importes.
update public.lotes_compra lc
set descuento_total = greatest(
      coalesce(lc.descuento_total, 0),
      coalesce(lc.ahorro_total, 0),
      coalesce(lc.descuento_cupon, 0) + coalesce(lc.puntos_total, 0)
    ),
    total_productos_con_descuento = greatest(
      coalesce(lc.subtotal_pagina, 0)
      - greatest(
          coalesce(lc.descuento_total, 0),
          coalesce(lc.ahorro_total, 0),
          coalesce(lc.descuento_cupon, 0) + coalesce(lc.puntos_total, 0)
        ),
      0
    ),
    costos_extra_total =
      coalesce(lc.envio, 0)
      + coalesce(lc.importacion, 0)
      + coalesce(lc.impuestos, 0)
      + coalesce(lc.comisiones, 0),
    actualizado_en = now()
where (
    coalesce(lc.total_productos_con_descuento, 0) = 0
    and coalesce(lc.subtotal_pagina, 0) > 0
  )
  or (
    coalesce(lc.costos_extra_total, 0) = 0
    and (
      coalesce(lc.envio, 0)
      + coalesce(lc.importacion, 0)
      + coalesce(lc.impuestos, 0)
      + coalesce(lc.comisiones, 0)
    ) > 0
  );

-- Recalcula cada pedido desde sus productos y pagos. El saldo nunca se fuerza:
-- los anticipos superiores al total se conservan para revision manual.
do $$
declare
  v_id uuid;
begin
  for v_id in select p.id from public.pedidos p order by p.id loop
    perform public.ordely_recalcular_totales_pedido_interno(v_id);
  end loop;
end;
$$;

-- pedidos_usados representa ahora los intentos del periodo vigente.
update public.perfiles p
set pedidos_usados = public.contar_intentos_pedidos(p.user_id),
    actualizado_en = now();

-- Aviso agregado, sin mostrar clientes ni pedidos concretos. Estos casos no se
-- corrigen automaticamente porque requieren decidir si se devuelve dinero o si
-- el total del pedido necesita una correccion comercial.
do $$
declare
  v_sobrepagados bigint;
  v_monto numeric;
begin
  select count(*), coalesce(sum(p.anticipo - p.total_cliente), 0)
  into v_sobrepagados, v_monto
  from public.pedidos p
  where p.anticipo > p.total_cliente + 0.005;

  if v_sobrepagados > 0 then
    raise notice 'Ordely: % pedido(s) conservan sobrepago por un total de %. Requieren revision manual.',
      v_sobrepagados,
      round(v_monto, 2);
  end if;
end;
$$;

commit;
