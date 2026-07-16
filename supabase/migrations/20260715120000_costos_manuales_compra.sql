-- Ordely 1.1.0 - costos reales capturados por producto en compras agrupadas.
-- No se aplica automaticamente. La funcion original permanece disponible.

begin;

create or replace function public.crear_lote_compra_costos_manuales_v1(
  p_plataforma text,
  p_numero_orden text,
  p_cupon text,
  p_envio numeric,
  p_importacion numeric,
  p_impuestos numeric,
  p_comisiones numeric,
  p_total_pagado numeric,
  p_fecha_compra date,
  p_productos jsonb
) returns public.lotes_compra
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_lote public.lotes_compra%rowtype;
  v_linea record;
  v_pedido_id uuid;
  v_ids uuid[];
  v_plataforma text := coalesce(nullif(btrim(p_plataforma), ''), 'SHEIN');
  v_codigo text;
  v_prefijo text;
  v_fecha date := coalesce(p_fecha_compra, current_date);
  v_fecha_ts timestamptz;
  v_dias integer;
  v_entradas integer := 0;
  v_ids_unicos integer := 0;
  v_productos_count integer := 0;
  v_indice integer := 0;
  v_subtotal numeric := 0;
  v_costo_productos numeric := 0;
  v_ahorro_productos numeric := 0;
  v_envio numeric := greatest(coalesce(p_envio, 0), 0);
  v_importacion numeric := greatest(coalesce(p_importacion, 0), 0);
  v_impuestos numeric := greatest(coalesce(p_impuestos, 0), 0);
  v_comisiones numeric := greatest(coalesce(p_comisiones, 0), 0);
  v_costos_extra numeric := 0;
  v_total_calculado numeric := 0;
  v_total_efectivo numeric := 0;
  v_subtotal_producto numeric := 0;
  v_costo_total numeric := 0;
  v_costo_unitario numeric := 0;
  v_descuento_producto numeric := 0;
  v_factor numeric := 0;
  v_envio_producto numeric := 0;
  v_importacion_producto numeric := 0;
  v_impuesto_producto numeric := 0;
  v_comision_producto numeric := 0;
  v_envio_asignado numeric := 0;
  v_importacion_asignada numeric := 0;
  v_impuestos_asignados numeric := 0;
  v_comisiones_asignadas numeric := 0;
  v_ganancia numeric := 0;
begin
  if v_user is null then
    raise exception 'No autorizado';
  end if;

  if p_productos is null
     or jsonb_typeof(p_productos) <> 'array'
     or jsonb_array_length(p_productos) = 0 then
    raise exception 'Captura el costo real de los productos seleccionados';
  end if;

  if coalesce(p_envio, 0) = 'NaN'::numeric
     or coalesce(p_importacion, 0) = 'NaN'::numeric
     or coalesce(p_impuestos, 0) = 'NaN'::numeric
     or coalesce(p_comisiones, 0) = 'NaN'::numeric
     or coalesce(p_total_pagado, 0) = 'NaN'::numeric
     or coalesce(p_envio, 0) < 0
     or coalesce(p_importacion, 0) < 0
     or coalesce(p_impuestos, 0) < 0
     or coalesce(p_comisiones, 0) < 0
     or coalesce(p_total_pagado, 0) < 0 then
    raise exception 'Los importes de la compra no son validos';
  end if;

  with entradas as (
    select producto_id, costo_total
    from jsonb_to_recordset(p_productos)
      as item(producto_id uuid, costo_total numeric)
  )
  select
    count(*)::integer,
    count(distinct producto_id)::integer,
    array_agg(producto_id order by producto_id),
    round(coalesce(sum(costo_total), 0), 2)
  into v_entradas, v_ids_unicos, v_ids, v_costo_productos
  from entradas
  where producto_id is not null
    and costo_total is not null
    and costo_total <> 'NaN'::numeric
    and costo_total >= 0;

  if v_entradas <> jsonb_array_length(p_productos)
     or v_ids_unicos <> v_entradas then
    raise exception 'Hay costos vacios, invalidos o productos repetidos';
  end if;

  perform pp.id
  from public.productos_pedido pp
  join public.pedidos p on p.id = pp.pedido_id
  where pp.id = any(v_ids)
    and pp.user_id = v_user
    and p.user_id = v_user
  order by pp.id
  for update of pp;

  select
    count(*)::integer,
    round(coalesce(sum(coalesce(pp.precio_pagina, pp.precio_shein, 0) * pp.cantidad), 0), 2)
  into v_productos_count, v_subtotal
  from public.productos_pedido pp
  join public.pedidos p on p.id = pp.pedido_id
  where pp.id = any(v_ids)
    and pp.user_id = v_user
    and p.user_id = v_user
    and pp.lote_compra_id is null
    and p.estado not in ('Cancelado', 'Devuelto', 'Entregado');

  if v_productos_count <> v_entradas then
    raise exception 'Hay productos inexistentes, cerrados o ya incluidos en otra compra';
  end if;

  if v_subtotal <= 0 then
    raise exception 'No hay subtotal valido para la compra';
  end if;

  v_costos_extra := round(v_envio + v_importacion + v_impuestos + v_comisiones, 2);
  v_total_calculado := round(v_costo_productos + v_costos_extra, 2);
  v_ahorro_productos := round(greatest(v_subtotal - v_costo_productos, 0), 2);

  if coalesce(p_total_pagado, 0) > 0
     and abs(round(p_total_pagado, 2) - v_total_calculado) > 0.009 then
    raise exception 'El total pagado no coincide con los costos manuales y cargos de los pedidos';
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
    btrim(coalesce(p_numero_orden, '')),
    upper(btrim(coalesce(p_cupon, ''))),
    v_subtotal,
    v_ahorro_productos,
    0,
    v_ahorro_productos,
    v_envio,
    v_importacion,
    v_impuestos,
    v_comisiones,
    v_costo_productos,
    v_costos_extra,
    v_total_efectivo,
    v_ahorro_productos,
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

  for v_linea in
    select pp.*, entrada.costo_total as costo_manual
    from public.productos_pedido pp
    join jsonb_to_recordset(p_productos)
      as entrada(producto_id uuid, costo_total numeric)
      on entrada.producto_id = pp.id
    where pp.user_id = v_user
      and pp.lote_compra_id is null
    order by pp.id
  loop
    v_indice := v_indice + 1;
    v_subtotal_producto := round(
      coalesce(v_linea.precio_pagina, v_linea.precio_shein, 0) * v_linea.cantidad,
      2
    );
    v_costo_total := round(v_linea.costo_manual, 2);
    v_costo_unitario := round(v_costo_total / v_linea.cantidad, 2);
    v_descuento_producto := round(greatest(v_subtotal_producto - v_costo_total, 0), 2);
    v_factor := v_subtotal_producto / v_subtotal;

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

    v_envio_asignado := v_envio_asignado + v_envio_producto;
    v_importacion_asignada := v_importacion_asignada + v_importacion_producto;
    v_impuestos_asignados := v_impuestos_asignados + v_impuesto_producto;
    v_comisiones_asignadas := v_comisiones_asignadas + v_comision_producto;
    v_ganancia := round(
      coalesce(v_linea.precio_venta, 0) * v_linea.cantidad - v_costo_total,
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
      v_linea.id,
      v_linea.pedido_id,
      coalesce(v_linea.precio_pagina, v_linea.precio_shein, 0),
      v_linea.cantidad,
      v_subtotal_producto,
      v_descuento_producto > 0,
      v_descuento_producto,
      0,
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
        puntos_asignados = 0,
        envio_asignado = v_envio_producto,
        importacion_asignada = v_importacion_producto,
        impuesto_asignado = v_impuesto_producto,
        comision_asignada = v_comision_producto,
        estado_compra = 'En camino',
        fecha_comprado = v_fecha_ts,
        fecha_estimada_llegada = v_fecha + v_dias
    where pp.id = v_linea.id;
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

revoke all on function public.crear_lote_compra_costos_manuales_v1(
  text, text, text, numeric, numeric, numeric, numeric, numeric, date, jsonb
) from public, anon;

grant execute on function public.crear_lote_compra_costos_manuales_v1(
  text, text, text, numeric, numeric, numeric, numeric, numeric, date, jsonb
) to authenticated;

commit;
