--
-- PostgreSQL database dump
--

-- \restrict AIH7CG2s5eiTLjeWDziQvpWHSVoUTKNyZgtj4k8WI4tT8GI8cA44tOihwF8GvcF

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
-- SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";

--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: productos_pedido; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."productos_pedido" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "pedido_id" "uuid",
    "nombre_producto" "text" NOT NULL,
    "link_shein" "text",
    "talla" "text",
    "color" "text",
    "cantidad" integer DEFAULT 1,
    "precio_shein" numeric(10,2) DEFAULT 0,
    "precio_venta" numeric(10,2) DEFAULT 0,
    "notas" "text",
    "creado_en" timestamp with time zone DEFAULT "now"(),
    "entregado" boolean DEFAULT false NOT NULL,
    "entregado_en" timestamp with time zone,
    "pagado_cliente" boolean DEFAULT false NOT NULL,
    "pagado_en" timestamp with time zone,
    "lote_compra_id" "uuid",
    "precio_pagina" numeric,
    "estado_compra" "text" DEFAULT 'Pendiente de compra'::"text",
    "participa_cupon" boolean DEFAULT true,
    "descuento_asignado" numeric DEFAULT 0,
    "envio_asignado" numeric DEFAULT 0,
    "comision_asignada" numeric DEFAULT 0,
    "costo_real_total" numeric,
    "costo_real_unitario" numeric,
    "ganancia_real" numeric,
    "fecha_agregado" timestamp with time zone DEFAULT "now"(),
    "fecha_comprado" timestamp with time zone,
    "fecha_estimada_llegada" "date",
    "fecha_recibido" timestamp with time zone,
    "fecha_dejado_negocio" timestamp with time zone,
    "fecha_entregado_cliente" timestamp with time zone,
    "puntos_asignados" numeric DEFAULT 0 NOT NULL,
    "importacion_asignada" numeric DEFAULT 0 NOT NULL,
    "impuesto_asignado" numeric DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."productos_pedido" OWNER TO "postgres";

--
-- Name: actualizar_estado_producto_logistica("uuid", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."actualizar_estado_producto_logistica"("p_producto_id" "uuid", "p_estado" "text") RETURNS "public"."productos_pedido"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_producto public.productos_pedido;
  v_pedido_id uuid;
  v_estado text := coalesce(nullif(trim(p_estado), ''), 'Recibido');
begin
  if auth.uid() is null then
    raise exception 'No autorizado';
  end if;

  select pp.* into v_producto
  from public.productos_pedido pp
  join public.pedidos p on p.id = pp.pedido_id
  where pp.id = p_producto_id
    and p.user_id = auth.uid();

  if not found then
    raise exception 'Producto no encontrado';
  end if;

  v_pedido_id := v_producto.pedido_id;

  if v_estado = 'Recibido' then
    update public.productos_pedido
    set estado_compra = 'Recibido',
        fecha_recibido = coalesce(fecha_recibido, now())
    where id = p_producto_id
    returning * into v_producto;
  elsif v_estado = 'Dejado en negocio' then
    update public.productos_pedido
    set estado_compra = 'Dejado en negocio',
        fecha_recibido = coalesce(fecha_recibido, now()),
        fecha_dejado_negocio = coalesce(fecha_dejado_negocio, now())
    where id = p_producto_id
    returning * into v_producto;
  elsif v_estado = 'Entregado' then
    update public.productos_pedido
    set estado_compra = 'Entregado',
        fecha_recibido = coalesce(fecha_recibido, now()),
        fecha_entregado_cliente = coalesce(fecha_entregado_cliente, now()),
        entregado = true,
        pagado_cliente = true
    where id = p_producto_id
    returning * into v_producto;
  else
    raise exception 'Estado logístico no válido';
  end if;

  if not exists (
    select 1 from public.productos_pedido
    where pedido_id = v_pedido_id
      and coalesce(estado_compra, 'Pendiente de compra') not in ('Entregado')
  ) then
    update public.pedidos
    set estado = 'Entregado', fecha_entregado = coalesce(fecha_entregado, now())
    where id = v_pedido_id
      and estado not in ('Cancelado', 'Devuelto');
  elsif not exists (
    select 1 from public.productos_pedido
    where pedido_id = v_pedido_id
      and coalesce(estado_compra, 'Pendiente de compra') not in ('Dejado en negocio', 'Entregado')
  ) then
    update public.pedidos
    set estado = 'Dejado en negocio', fecha_dejado_negocio = coalesce(fecha_dejado_negocio, now())
    where id = v_pedido_id
      and estado not in ('Cancelado', 'Devuelto', 'Entregado');
  elsif not exists (
    select 1 from public.productos_pedido
    where pedido_id = v_pedido_id
      and coalesce(estado_compra, 'Pendiente de compra') not in ('Recibido', 'Dejado en negocio', 'Entregado')
  ) then
    update public.pedidos
    set estado = 'Recibido', fecha_recibido = coalesce(fecha_recibido, now())
    where id = v_pedido_id
      and estado not in ('Cancelado', 'Devuelto', 'Entregado', 'Dejado en negocio');
  end if;

  return v_producto;
end;
$$;


ALTER FUNCTION "public"."actualizar_estado_producto_logistica"("p_producto_id" "uuid", "p_estado" "text") OWNER TO "postgres";

--
-- Name: actualizar_mi_plataforma("text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."actualizar_mi_plataforma"("p_plataforma" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if p_plataforma not in ('SHEIN', 'Temu', 'AliExpress', 'Catálogo', 'Otro') then
    raise exception 'Plataforma no válida';
  end if;

  update public.perfiles
  set
    plataforma_predeterminada = p_plataforma,
    actualizado_en = now()
  where user_id = auth.uid();
end;
$$;


ALTER FUNCTION "public"."actualizar_mi_plataforma"("p_plataforma" "text") OWNER TO "postgres";

--
-- Name: admin_actualizar_estado_suscripcion("uuid", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_actualizar_estado_suscripcion"("p_suscripcion_id" "uuid", "p_estado_pago" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.es_admin_actual() then
    raise exception 'No autorizado';
  end if;

  if p_estado_pago not in ('pendiente', 'pagado', 'cancelado', 'vencido', 'reembolsado') then
    raise exception 'Estado no válido';
  end if;

  update public.suscripciones
  set
    estado_pago = p_estado_pago,
    actualizado_en = now()
  where id = p_suscripcion_id;
end;
$$;


ALTER FUNCTION "public"."admin_actualizar_estado_suscripcion"("p_suscripcion_id" "uuid", "p_estado_pago" "text") OWNER TO "postgres";

--
-- Name: admin_agregar_dias_usuario("uuid", integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_agregar_dias_usuario"("p_user_id" "uuid", "p_dias" integer) RETURNS TABLE("exito" boolean, "mensaje" "text", "vence_en" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_base timestamptz;
begin
  if not public.ordely_es_admin() then raise exception 'Acceso no autorizado'; end if;
  if p_dias is null or p_dias < 1 or p_dias > 3650 then raise exception 'Cantidad de días inválida'; end if;

  select greatest(coalesce(plan_expira_en, now()), now()) into v_base
  from public.perfiles where user_id = p_user_id for update;

  if v_base is null then raise exception 'Usuario no encontrado'; end if;

  update public.perfiles
  set plan_expira_en = v_base + make_interval(days => p_dias),
      estado_suscripcion = 'activa',
      suscripcion_cancelada_en = null,
      cuenta_bloqueada = false
  where user_id = p_user_id;

  return query select true, format('Se agregaron %s días al periodo.', p_dias), v_base + make_interval(days => p_dias);
end;
$$;


ALTER FUNCTION "public"."admin_agregar_dias_usuario"("p_user_id" "uuid", "p_dias" integer) OWNER TO "postgres";

--
-- Name: admin_bloquear_usuario("uuid", boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_bloquear_usuario"("p_user_id" "uuid", "p_bloqueada" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.es_admin_actual() then
    raise exception 'No autorizado';
  end if;

  update public.perfiles
  set
    cuenta_bloqueada = p_bloqueada,
    actualizado_en = now()
  where user_id = p_user_id;
end;
$$;


ALTER FUNCTION "public"."admin_bloquear_usuario"("p_user_id" "uuid", "p_bloqueada" boolean) OWNER TO "postgres";

--
-- Name: admin_cambiar_estado_codigo("uuid", boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_cambiar_estado_codigo"("p_codigo_id" "uuid", "p_activo" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.es_admin_actual() then
    raise exception 'No autorizado';
  end if;

  update public.codigos_promocionales
  set
    activo = p_activo,
    actualizado_en = now()
  where id = p_codigo_id;
end;
$$;


ALTER FUNCTION "public"."admin_cambiar_estado_codigo"("p_codigo_id" "uuid", "p_activo" boolean) OWNER TO "postgres";

--
-- Name: admin_cambiar_plan_usuario("uuid", "text", integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_cambiar_plan_usuario"("p_user_id" "uuid", "p_plan" "text", "p_duracion_dias" integer DEFAULT NULL::integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_expira_en timestamptz;
  v_limite integer;
begin
  if not public.es_admin_actual() then
    raise exception 'No autorizado';
  end if;

  if p_plan not in ('basico', 'premium', 'pro') then
    raise exception 'Plan no válido';
  end if;

  if p_duracion_dias is not null and p_duracion_dias <= 0 then
    raise exception 'La duración debe ser mayor a 0 o vacía para no vencer';
  end if;

  if p_plan = 'basico' then
    v_expira_en := null;
    v_limite := 30;
  else
    v_expira_en := case
      when p_duracion_dias is null then null
      else now() + make_interval(days => p_duracion_dias)
    end;
    v_limite := 999999;
  end if;

  update public.perfiles
  set
    plan_actual = p_plan,
    plan_origen = 'manual',
    plan_expira_en = v_expira_en,
    limite_pedidos = v_limite,
    cuenta_bloqueada = false,
    actualizado_en = now()
  where user_id = p_user_id;
end;
$$;


ALTER FUNCTION "public"."admin_cambiar_plan_usuario"("p_user_id" "uuid", "p_plan" "text", "p_duracion_dias" integer) OWNER TO "postgres";

--
-- Name: admin_cancelar_suscripcion_usuario("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_cancelar_suscripcion_usuario"("p_user_id" "uuid") RETURNS TABLE("exito" boolean, "mensaje" "text", "vence_en" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_vence timestamptz;
begin
  if not public.ordely_es_admin() then raise exception 'Acceso no autorizado'; end if;

  update public.perfiles
  set estado_suscripcion = 'cancelada',
      suscripcion_cancelada_en = now()
  where user_id = p_user_id
  returning plan_expira_en into v_vence;

  if not found then raise exception 'Usuario no encontrado'; end if;
  return query select true, 'Suscripción cancelada. El acceso continúa hasta el vencimiento.', v_vence;
end;
$$;


ALTER FUNCTION "public"."admin_cancelar_suscripcion_usuario"("p_user_id" "uuid") OWNER TO "postgres";

--
-- Name: admin_crear_codigo("text", "text", integer, integer, timestamp with time zone, "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_crear_codigo"("p_codigo" "text", "p_plan" "text", "p_duracion_dias" integer DEFAULT NULL::integer, "p_usos_maximos" integer DEFAULT 1, "p_codigo_expira_en" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_notas" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "codigo" "text", "plan" "text", "duracion_dias" integer, "usos_maximos" integer, "usos_actuales" integer, "activo" boolean, "codigo_expira_en" timestamp with time zone, "notas" "text", "creado_en" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_codigo text;
begin
  if not public.es_admin_actual() then
    raise exception 'No autorizado';
  end if;

  v_codigo := upper(trim(p_codigo));

  if v_codigo = '' then
    raise exception 'El código no puede ir vacío';
  end if;

  if p_plan not in ('premium', 'pro') then
    raise exception 'Plan no válido';
  end if;

  if p_duracion_dias is not null and p_duracion_dias <= 0 then
    raise exception 'La duración debe ser mayor a 0 o vacía para no vencer';
  end if;

  if p_usos_maximos is not null and p_usos_maximos <= 0 then
    raise exception 'Los usos máximos deben ser mayores a 0 o vacíos para ilimitado';
  end if;

  return query
  insert into public.codigos_promocionales (
    codigo,
    plan,
    duracion_dias,
    usos_maximos,
    usos_actuales,
    activo,
    codigo_expira_en,
    notas,
    creado_por
  )
  values (
    v_codigo,
    p_plan,
    p_duracion_dias,
    p_usos_maximos,
    0,
    true,
    p_codigo_expira_en,
    nullif(trim(coalesce(p_notas, '')), ''),
    auth.uid()
  )
  returning
    codigos_promocionales.id,
    codigos_promocionales.codigo,
    codigos_promocionales.plan,
    codigos_promocionales.duracion_dias,
    codigos_promocionales.usos_maximos,
    codigos_promocionales.usos_actuales,
    codigos_promocionales.activo,
    codigos_promocionales.codigo_expira_en,
    codigos_promocionales.notas,
    codigos_promocionales.creado_en;
end;
$$;


ALTER FUNCTION "public"."admin_crear_codigo"("p_codigo" "text", "p_plan" "text", "p_duracion_dias" integer, "p_usos_maximos" integer, "p_codigo_expira_en" timestamp with time zone, "p_notas" "text") OWNER TO "postgres";

--
-- Name: admin_listar_codigos(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_listar_codigos"() RETURNS TABLE("id" "uuid", "codigo" "text", "plan" "text", "duracion_dias" integer, "usos_maximos" integer, "usos_actuales" integer, "activo" boolean, "codigo_expira_en" timestamp with time zone, "notas" "text", "creado_en" timestamp with time zone, "usuarios_canjeados" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.es_admin_actual() then
    raise exception 'No autorizado';
  end if;

  return query
  select
    cp.id,
    cp.codigo,
    cp.plan,
    cp.duracion_dias,
    cp.usos_maximos,
    cp.usos_actuales,
    cp.activo,
    cp.codigo_expira_en,
    cp.notas,
    cp.creado_en,
    count(cc.id) as usuarios_canjeados
  from public.codigos_promocionales cp
  left join public.codigos_canjeados cc on cc.codigo_id = cp.id
  group by cp.id
  order by cp.creado_en desc;
end;
$$;


ALTER FUNCTION "public"."admin_listar_codigos"() OWNER TO "postgres";

--
-- Name: admin_listar_suscripciones(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_listar_suscripciones"() RETURNS TABLE("id" "uuid", "user_id" "uuid", "nombre" "text", "correo" "text", "plan" "text", "monto" numeric, "moneda" "text", "metodo_pago" "text", "estado_pago" "text", "fecha_inicio" timestamp with time zone, "fecha_fin" timestamp with time zone, "origen" "text", "notas" "text", "creado_en" timestamp with time zone, "creado_por_correo" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.es_admin_actual() then
    raise exception 'No autorizado';
  end if;

  perform 1 from public.admin_procesar_planes_vencidos();

  return query
  select
    s.id,
    s.user_id,
    p.nombre,
    p.correo,
    s.plan,
    s.monto,
    s.moneda,
    s.metodo_pago,
    s.estado_pago,
    s.fecha_inicio,
    s.fecha_fin,
    s.origen,
    s.notas,
    s.creado_en,
    au.email::text as creado_por_correo
  from public.suscripciones s
  left join public.perfiles p on p.user_id = s.user_id
  left join auth.users au on au.id = s.creado_por
  order by s.creado_en desc;
end;
$$;


ALTER FUNCTION "public"."admin_listar_suscripciones"() OWNER TO "postgres";

--
-- Name: admin_procesar_planes_vencidos(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_procesar_planes_vencidos"() RETURNS TABLE("perfiles_actualizados" integer, "suscripciones_vencidas" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_perfiles integer := 0;
  v_suscripciones integer := 0;
begin
  if not public.es_admin_actual() then
    raise exception 'No autorizado';
  end if;

  -- Marcar suscripciones vencidas.
  update public.suscripciones
  set
    estado_pago = 'vencido',
    actualizado_en = now()
  where estado_pago = 'pagado'
    and fecha_fin is not null
    and fecha_fin < now();

  get diagnostics v_suscripciones = row_count;

  -- Regresar a Básico las cuentas Premium/Pro vencidas.
  update public.perfiles
  set
    plan_actual = 'basico',
    plan_origen = 'sistema',
    plan_expira_en = null,
    limite_pedidos = 30,
    actualizado_en = now()
  where es_admin = false
    and plan_actual in ('premium', 'pro')
    and plan_expira_en is not null
    and plan_expira_en < now();

  get diagnostics v_perfiles = row_count;

  return query select v_perfiles, v_suscripciones;
end;
$$;


ALTER FUNCTION "public"."admin_procesar_planes_vencidos"() OWNER TO "postgres";

--
-- Name: admin_registrar_pago_manual("uuid", "text", numeric, "text", integer, boolean, "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_registrar_pago_manual"("p_user_id" "uuid", "p_plan" "text", "p_monto" numeric, "p_metodo_pago" "text", "p_duracion_dias" integer DEFAULT 30, "p_sin_vencimiento" boolean DEFAULT false, "p_notas" "text" DEFAULT NULL::"text") RETURNS TABLE("exito" boolean, "mensaje" "text", "suscripcion_id" "uuid", "plan_activado" "text", "vence_en" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_suscripcion_id uuid;
  v_fecha_inicio timestamptz;
  v_fecha_fin timestamptz;
begin
  if not public.es_admin_actual() then
    raise exception 'No autorizado';
  end if;

  if p_plan not in ('premium', 'pro') then
    raise exception 'Plan no válido';
  end if;

  if p_user_id is null then
    raise exception 'Usuario no válido';
  end if;

  v_fecha_inicio := now();

  if p_sin_vencimiento = true or p_duracion_dias is null then
    v_fecha_fin := null;
  else
    if p_duracion_dias <= 0 then
      raise exception 'La duración debe ser mayor a 0';
    end if;

    v_fecha_fin := v_fecha_inicio + make_interval(days => p_duracion_dias);
  end if;

  insert into public.suscripciones (
    user_id,
    plan,
    monto,
    moneda,
    metodo_pago,
    estado_pago,
    fecha_inicio,
    fecha_fin,
    origen,
    notas,
    creado_por
  )
  values (
    p_user_id,
    p_plan,
    coalesce(p_monto, 0),
    'MXN',
    coalesce(nullif(trim(p_metodo_pago), ''), 'manual'),
    'pagado',
    v_fecha_inicio,
    v_fecha_fin,
    'manual',
    nullif(trim(coalesce(p_notas, '')), ''),
    auth.uid()
  )
  returning id into v_suscripcion_id;

  update public.perfiles
  set
    plan_actual = p_plan,
    plan_origen = 'pago',
    plan_expira_en = v_fecha_fin,
    limite_pedidos = 999999,
    cuenta_bloqueada = false,
    actualizado_en = now()
  where user_id = p_user_id;

  return query
  select
    true,
    'Pago registrado y plan activado correctamente.'::text,
    v_suscripcion_id,
    p_plan,
    v_fecha_fin;
end;
$$;


ALTER FUNCTION "public"."admin_registrar_pago_manual"("p_user_id" "uuid", "p_plan" "text", "p_monto" numeric, "p_metodo_pago" "text", "p_duracion_dias" integer, "p_sin_vencimiento" boolean, "p_notas" "text") OWNER TO "postgres";

--
-- Name: admin_renovar_periodo_usuario("uuid", integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_renovar_periodo_usuario"("p_user_id" "uuid", "p_dias" integer DEFAULT 30) RETURNS TABLE("exito" boolean, "mensaje" "text", "vence_en" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_vence timestamptz;
begin
  if not public.ordely_es_admin() then raise exception 'Acceso no autorizado'; end if;
  if p_dias is null or p_dias < 1 or p_dias > 3650 then raise exception 'Cantidad de días inválida'; end if;

  v_vence := now() + make_interval(days => p_dias);

  update public.perfiles
  set periodo_inicia_en = now(),
      plan_expira_en = v_vence,
      pedidos_usados = 0,
      limite_pedidos = case when plan_actual = 'basico' then 30 else limite_pedidos end,
      estado_suscripcion = 'activa',
      suscripcion_cancelada_en = null,
      cuenta_bloqueada = false
  where user_id = p_user_id;

  if not found then raise exception 'Usuario no encontrado'; end if;
  return query select true, format('Periodo renovado por %s días y contador reiniciado.', p_dias), v_vence;
end;
$$;


ALTER FUNCTION "public"."admin_renovar_periodo_usuario"("p_user_id" "uuid", "p_dias" integer) OWNER TO "postgres";

--
-- Name: admin_usuarios_resumen(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_usuarios_resumen"() RETURNS TABLE("user_id" "uuid", "nombre" "text", "correo" "text", "plan_actual" "text", "plan_origen" "text", "plan_expira_en" timestamp with time zone, "limite_pedidos" integer, "es_admin" boolean, "cuenta_bloqueada" boolean, "plataforma_predeterminada" "text", "creado_en" timestamp with time zone, "pedidos_usados" bigint, "limite_alcanzado" boolean, "puede_modificar" boolean, "plan_vencido" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    p.user_id,
    p.nombre,
    p.correo,
    case
      when p.plan_expira_en is not null and p.plan_expira_en < now() then 'basico'
      else coalesce(p.plan_actual, 'basico')
    end as plan_actual,
    p.plan_origen,
    p.plan_expira_en,
    p.limite_pedidos,
    p.es_admin,
    p.cuenta_bloqueada,
    p.plataforma_predeterminada,
    p.creado_en,
    coalesce(pi.intentos, 0)::bigint as pedidos_usados,
    (
      case
        when p.plan_expira_en is not null and p.plan_expira_en < now() then 'basico'
        else coalesce(p.plan_actual, 'basico')
      end = 'basico'
      and coalesce(pi.intentos, 0)::bigint >= coalesce(p.limite_pedidos, 30)
    ) as limite_alcanzado,
    (
      not coalesce(p.cuenta_bloqueada, false)
      and (
        coalesce(p.es_admin, false)
        or case
          when p.plan_expira_en is not null and p.plan_expira_en < now() then 'basico'
          else coalesce(p.plan_actual, 'basico')
        end in ('premium', 'pro')
        or coalesce(pi.intentos, 0)::bigint < coalesce(p.limite_pedidos, 30)
      )
    ) as puede_modificar,
    (p.plan_expira_en is not null and p.plan_expira_en < now()) as plan_vencido
  from public.perfiles p
  left join (
    select user_id, count(*)::bigint as intentos
    from public.pedidos_intentos
    group by user_id
  ) pi on pi.user_id = p.user_id
  where public.es_admin_actual()
  order by p.creado_en desc;
$$;


ALTER FUNCTION "public"."admin_usuarios_resumen"() OWNER TO "postgres";

--
-- Name: bloquear_crear_pedido_si_limite(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."bloquear_crear_pedido_si_limite"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user uuid;
begin
  v_user := coalesce(new.user_id, auth.uid());

  if v_user is null then
    raise exception 'Usuario no autenticado';
  end if;

  new.user_id := v_user;

  if not public.usuario_puede_crear_pedido(v_user) then
    raise exception 'Límite del Plan Básico alcanzado. Actualiza a Premium para crear más pedidos.';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."bloquear_crear_pedido_si_limite"() OWNER TO "postgres";

--
-- Name: canjear_codigo("text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."canjear_codigo"("p_codigo" "text") RETURNS TABLE("exito" boolean, "mensaje" "text", "nuevo_plan" "text", "vence_en" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_codigo text;
  v_codigo_record public.codigos_promocionales%rowtype;
  v_perfil public.perfiles%rowtype;
  v_user uuid;
  v_expira_en timestamptz;
  v_current_rank integer;
  v_new_rank integer;
  v_current_plan text;
  v_base_expira timestamptz;
begin
  v_user := auth.uid();

  if v_user is null then
    return query select false, 'Debes iniciar sesión para canjear un código.', null::text, null::timestamptz;
    return;
  end if;

  v_codigo := upper(trim(p_codigo));

  if v_codigo = '' then
    return query select false, 'Escribe un código válido.', null::text, null::timestamptz;
    return;
  end if;

  select * into v_perfil
  from public.perfiles
  where user_id = v_user;

  if not found then
    return query select false, 'No se encontró tu perfil. Cierra sesión y vuelve a entrar.', null::text, null::timestamptz;
    return;
  end if;

  select * into v_codigo_record
  from public.codigos_promocionales
  where codigo = v_codigo
  for update;

  if not found then
    return query select false, 'El código no existe.', null::text, null::timestamptz;
    return;
  end if;

  if not v_codigo_record.activo then
    return query select false, 'Este código está desactivado.', null::text, null::timestamptz;
    return;
  end if;

  if v_codigo_record.codigo_expira_en is not null and v_codigo_record.codigo_expira_en < now() then
    return query select false, 'Este código ya venció.', null::text, null::timestamptz;
    return;
  end if;

  if v_codigo_record.usos_maximos is not null and v_codigo_record.usos_actuales >= v_codigo_record.usos_maximos then
    return query select false, 'Este código ya agotó sus usos disponibles.', null::text, null::timestamptz;
    return;
  end if;

  if exists (
    select 1
    from public.codigos_canjeados
    where codigo_id = v_codigo_record.id
      and user_id = v_user
  ) then
    return query select false, 'Ya canjeaste este código anteriormente.', null::text, null::timestamptz;
    return;
  end if;

  v_current_plan := v_perfil.plan_actual;

  if v_perfil.plan_expira_en is not null and v_perfil.plan_expira_en < now() then
    v_current_plan := 'basico';
  end if;

  v_current_rank := case v_current_plan
    when 'pro' then 3
    when 'premium' then 2
    else 1
  end;

  v_new_rank := case v_codigo_record.plan
    when 'pro' then 3
    when 'premium' then 2
    else 1
  end;

  if v_current_rank > v_new_rank then
    return query select false, 'Tu plan actual es superior al plan de este código.', v_perfil.plan_actual, v_perfil.plan_expira_en;
    return;
  end if;

  if v_current_rank = v_new_rank and v_perfil.plan_expira_en is null and v_current_plan <> 'basico' then
    return query select false, 'Tu plan actual ya no tiene vencimiento. No necesitas este código.', v_perfil.plan_actual, v_perfil.plan_expira_en;
    return;
  end if;

  if v_codigo_record.duracion_dias is null then
    v_expira_en := null;
  else
    v_base_expira := now();

    if v_current_plan = v_codigo_record.plan
       and v_perfil.plan_expira_en is not null
       and v_perfil.plan_expira_en > now() then
      v_base_expira := v_perfil.plan_expira_en;
    end if;

    v_expira_en := v_base_expira + make_interval(days => v_codigo_record.duracion_dias);
  end if;

  insert into public.codigos_canjeados (
    codigo_id,
    user_id,
    codigo,
    plan_otorgado,
    plan_expira_en
  )
  values (
    v_codigo_record.id,
    v_user,
    v_codigo_record.codigo,
    v_codigo_record.plan,
    v_expira_en
  );

  update public.codigos_promocionales
  set
    usos_actuales = usos_actuales + 1,
    actualizado_en = now()
  where id = v_codigo_record.id;

  update public.perfiles
  set
    plan_actual = v_codigo_record.plan,
    plan_origen = 'codigo',
    plan_expira_en = v_expira_en,
    limite_pedidos = 999999,
    cuenta_bloqueada = false,
    actualizado_en = now()
  where user_id = v_user;

  return query select
    true,
    case
      when v_expira_en is null then 'Código aplicado correctamente. Tu plan no tiene fecha de vencimiento.'
      else 'Código aplicado correctamente. Tu plan quedó activo temporalmente.'
    end,
    v_codigo_record.plan,
    v_expira_en;
end;
$$;


ALTER FUNCTION "public"."canjear_codigo"("p_codigo" "text") OWNER TO "postgres";

--
-- Name: contar_intentos_pedidos("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."contar_intentos_pedidos"("p_user" "uuid" DEFAULT "auth"."uid"()) RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select count(*)::bigint
  from public.pedidos_intentos pi
  where pi.user_id = p_user;
$$;


ALTER FUNCTION "public"."contar_intentos_pedidos"("p_user" "uuid") OWNER TO "postgres";

--
-- Name: correo_ya_registrado("text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."correo_ya_registrado"("p_correo" "text") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.perfiles
    where lower(correo) = lower(trim(p_correo))
  );
$$;


ALTER FUNCTION "public"."correo_ya_registrado"("p_correo" "text") OWNER TO "postgres";

--
-- Name: lotes_compra; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."lotes_compra" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "codigo_lote" "text" NOT NULL,
    "plataforma" "text" DEFAULT 'SHEIN'::"text" NOT NULL,
    "numero_orden_plataforma" "text",
    "cupon_usado" "text",
    "subtotal_pagina" numeric DEFAULT 0 NOT NULL,
    "descuento_total" numeric DEFAULT 0 NOT NULL,
    "envio" numeric DEFAULT 0 NOT NULL,
    "comisiones" numeric DEFAULT 0 NOT NULL,
    "total_pagado" numeric DEFAULT 0 NOT NULL,
    "ahorro_total" numeric DEFAULT 0 NOT NULL,
    "estado" "text" DEFAULT 'Comprado'::"text" NOT NULL,
    "fecha_compra" "date" DEFAULT CURRENT_DATE NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "descuento_cupon" numeric DEFAULT 0 NOT NULL,
    "puntos_total" numeric DEFAULT 0 NOT NULL,
    "importacion" numeric DEFAULT 0 NOT NULL,
    "impuestos" numeric DEFAULT 0 NOT NULL,
    "total_productos_con_descuento" numeric DEFAULT 0 NOT NULL,
    "costos_extra_total" numeric DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."lotes_compra" OWNER TO "postgres";

--
-- Name: crear_lote_compra("text", "text", "text", numeric, numeric, numeric, numeric, numeric, numeric, numeric, "date", "uuid"[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."crear_lote_compra"("p_plataforma" "text", "p_numero_orden" "text", "p_cupon" "text", "p_descuento_cupon" numeric, "p_puntos" numeric, "p_envio" numeric, "p_importacion" numeric, "p_impuestos" numeric, "p_comisiones" numeric, "p_total_pagado" numeric, "p_fecha_compra" "date", "p_productos" "uuid"[]) RETURNS "public"."lotes_compra"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_lote public.lotes_compra;
  v_producto public.productos_pedido;
  v_pedido public.pedidos;
  v_codigo text;
  v_plataforma text := coalesce(nullif(trim(p_plataforma), ''), 'SHEIN');
  v_subtotal numeric := 0;
  v_subtotal_cupon numeric := 0;
  v_descuento_cupon numeric := greatest(coalesce(p_descuento_cupon, 0), 0);
  v_puntos numeric := greatest(coalesce(p_puntos, 0), 0);
  v_descuento_total numeric := 0;
  v_envio numeric := greatest(coalesce(p_envio, 0), 0);
  v_importacion numeric := greatest(coalesce(p_importacion, 0), 0);
  v_impuestos numeric := greatest(coalesce(p_impuestos, 0), 0);
  v_comisiones numeric := greatest(coalesce(p_comisiones, 0), 0);
  v_costos_extra numeric := 0;
  v_total_productos_con_descuento numeric := 0;
  v_total_calculado numeric := 0;
  v_fecha date := coalesce(p_fecha_compra, current_date);
  v_dias integer := 10;
  v_factor numeric := 0;
  v_descuento_producto numeric := 0;
  v_puntos_producto numeric := 0;
  v_descuento_producto_total numeric := 0;
  v_envio_producto numeric := 0;
  v_importacion_producto numeric := 0;
  v_impuesto_producto numeric := 0;
  v_comision_producto numeric := 0;
  v_costo_total numeric := 0;
  v_costo_unitario numeric := 0;
  v_ganancia_total numeric := 0;
  v_subtotal_producto numeric := 0;
begin
  if auth.uid() is null then
    raise exception 'No autorizado';
  end if;

  if p_productos is null or array_length(p_productos, 1) is null then
    raise exception 'Selecciona productos para registrar la compra';
  end if;

  select coalesce(sum(coalesce(pp.precio_pagina, pp.precio_shein, 0) * coalesce(pp.cantidad, 0)), 0)
  into v_subtotal
  from public.productos_pedido pp
  join public.pedidos p on p.id = pp.pedido_id
  where pp.id = any(p_productos)
    and p.user_id = auth.uid()
    and pp.lote_compra_id is null;

  select coalesce(sum(coalesce(pp.precio_pagina, pp.precio_shein, 0) * coalesce(pp.cantidad, 0)), 0)
  into v_subtotal_cupon
  from public.productos_pedido pp
  join public.pedidos p on p.id = pp.pedido_id
  where pp.id = any(p_productos)
    and p.user_id = auth.uid()
    and pp.lote_compra_id is null
    and coalesce(pp.participa_cupon, true) = true;

  if v_subtotal <= 0 then
    raise exception 'No hay subtotal válido para la compra';
  end if;

  v_descuento_cupon := least(v_descuento_cupon, v_subtotal);
  v_puntos := least(v_puntos, greatest(v_subtotal - v_descuento_cupon, 0));
  v_descuento_total := least(v_descuento_cupon + v_puntos, v_subtotal);
  v_costos_extra := v_envio + v_importacion + v_impuestos + v_comisiones;
  v_total_productos_con_descuento := greatest(v_subtotal - v_descuento_total, 0);
  v_total_calculado := greatest(v_total_productos_con_descuento + v_costos_extra, 0);

  v_codigo := upper(left(v_plataforma, 3)) || '-' || to_char(now(), 'YYYYMMDD-HH24MISS');

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
    auth.uid(),
    v_codigo,
    v_plataforma,
    trim(coalesce(p_numero_orden, '')),
    upper(trim(coalesce(p_cupon, ''))),
    v_subtotal,
    v_descuento_cupon,
    v_puntos,
    v_descuento_total,
    v_envio,
    v_importacion,
    v_impuestos,
    v_comisiones,
    v_total_productos_con_descuento,
    v_costos_extra,
    coalesce(nullif(p_total_pagado, 0), v_total_calculado),
    v_descuento_total,
    v_fecha
  ) returning * into v_lote;

  v_dias := public.obtener_dias_estimados_plataforma(auth.uid(), v_plataforma);

  for v_producto in
    select pp.*
    from public.productos_pedido pp
    join public.pedidos p on p.id = pp.pedido_id
    where pp.id = any(p_productos)
      and p.user_id = auth.uid()
      and pp.lote_compra_id is null
  loop
    v_subtotal_producto := coalesce(v_producto.precio_pagina, v_producto.precio_shein, 0) * coalesce(v_producto.cantidad, 0);
    v_factor := case when v_subtotal > 0 then v_subtotal_producto / v_subtotal else 0 end;

    if coalesce(v_producto.participa_cupon, true) = true and v_subtotal_cupon > 0 then
      v_descuento_producto := round(v_descuento_cupon * (v_subtotal_producto / v_subtotal_cupon), 2);
      v_puntos_producto := round(v_puntos * (v_subtotal_producto / v_subtotal_cupon), 2);
    else
      v_descuento_producto := 0;
      v_puntos_producto := 0;
    end if;

    v_descuento_producto_total := least(v_descuento_producto + v_puntos_producto, v_subtotal_producto);

    -- Se guardan para historial, pero NO se suman al costo real del producto.
    v_envio_producto := round(v_envio * v_factor, 2);
    v_importacion_producto := round(v_importacion * v_factor, 2);
    v_impuesto_producto := round(v_impuestos * v_factor, 2);
    v_comision_producto := round(v_comisiones * v_factor, 2);

    -- Costo real del producto = precio página - cupón - puntos.
    -- Envío/importación/impuestos/comisiones quedan separados en el lote.
    v_costo_total := greatest(v_subtotal_producto - v_descuento_producto_total, 0);
    v_costo_unitario := case when coalesce(v_producto.cantidad, 0) > 0 then round(v_costo_total / v_producto.cantidad, 2) else 0 end;
    v_ganancia_total := (coalesce(v_producto.precio_venta, coalesce(v_producto.precio_pagina, v_producto.precio_shein, 0)) * coalesce(v_producto.cantidad, 0)) - v_costo_total;

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
      coalesce(v_producto.cantidad, 0),
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
      v_ganancia_total
    );

    update public.productos_pedido
    set
      lote_compra_id = v_lote.id,
      precio_shein = v_costo_unitario,
      costo_real_unitario = v_costo_unitario,
      costo_real_total = v_costo_total,
      ganancia_real = v_ganancia_total,
      descuento_asignado = v_descuento_producto,
      puntos_asignados = v_puntos_producto,
      envio_asignado = v_envio_producto,
      importacion_asignada = v_importacion_producto,
      impuesto_asignado = v_impuesto_producto,
      comision_asignada = v_comision_producto,
      estado_compra = 'En camino',
      fecha_comprado = v_fecha::timestamptz,
      fecha_estimada_llegada = v_fecha + v_dias
    where id = v_producto.id;
  end loop;

  -- Actualiza pedidos involucrados.
  for v_pedido in
    select distinct p.*
    from public.pedidos p
    join public.productos_pedido pp on pp.pedido_id = p.id
    where pp.lote_compra_id = v_lote.id
  loop
    perform public.recalcular_totales_pedido(v_pedido.id);

    if not exists (
      select 1 from public.productos_pedido pp
      where pp.pedido_id = v_pedido.id
        and coalesce(pp.estado_compra, 'Pendiente de compra') = 'Pendiente de compra'
    ) then
      update public.pedidos
      set estado = case when estado in ('Cancelado', 'Devuelto', 'Entregado') then estado else 'En camino' end,
          fecha_comprado = coalesce(fecha_comprado, now())
      where id = v_pedido.id;
    end if;
  end loop;

  return v_lote;
end;
$$;


ALTER FUNCTION "public"."crear_lote_compra"("p_plataforma" "text", "p_numero_orden" "text", "p_cupon" "text", "p_descuento_cupon" numeric, "p_puntos" numeric, "p_envio" numeric, "p_importacion" numeric, "p_impuestos" numeric, "p_comisiones" numeric, "p_total_pagado" numeric, "p_fecha_compra" "date", "p_productos" "uuid"[]) OWNER TO "postgres";

--
-- Name: crear_pedido_completo("uuid", "text", "text", "text", "text", "jsonb", numeric, "date"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."crear_pedido_completo"("p_cliente_id" "uuid", "p_plataforma" "text", "p_estado" "text", "p_tracking" "text", "p_notas" "text", "p_productos" "jsonb", "p_anticipo" numeric, "p_fecha_creacion" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_perfil jsonb;
  v_cliente jsonb;
  v_plan text;
  v_es_admin boolean;
  v_limite_pedidos integer;
  v_pedidos_usados integer;
  v_total_shein numeric(14, 2) := 0;
  v_total_cliente numeric(14, 2) := 0;
  v_anticipo numeric(14, 2) := coalesce(p_anticipo, 0);
  v_codigo text;
  v_prefijo text;
  v_pedido public.pedidos%rowtype;
begin
  if v_user_id is null then
    raise exception 'Debes iniciar sesión para crear un pedido.';
  end if;

  select to_jsonb(perfil)
  into v_perfil
  from public.perfiles as perfil
  where perfil.user_id = v_user_id
  limit 1;

  if v_perfil is null then
    raise exception 'No se encontró el perfil de la cuenta.';
  end if;

  v_plan := lower(coalesce(nullif(v_perfil ->> 'plan_actual', ''), 'basico'));
  v_es_admin := coalesce(nullif(v_perfil ->> 'es_admin', '')::boolean, false);
  v_limite_pedidos := greatest(
    coalesce(nullif(v_perfil ->> 'limite_pedidos', '')::integer, 30),
    1
  );

  select count(*)::integer
  into v_pedidos_usados
  from public.pedidos as pedido
  where pedido.user_id = v_user_id;

  -- Premium, Pro y administradores no quedan bloqueados por este límite.
  if v_plan = 'basico'
     and not v_es_admin
     and v_pedidos_usados >= v_limite_pedidos then
    raise exception 'Llegaste al límite de % pedidos del Plan Básico.', v_limite_pedidos;
  end if;

  select to_jsonb(cliente)
  into v_cliente
  from public.clientes as cliente
  where cliente.id = p_cliente_id
  limit 1;

  if v_cliente is null
     or coalesce(v_cliente ->> 'user_id', '') <> v_user_id::text then
    raise exception 'El cliente seleccionado no pertenece a esta cuenta.';
  end if;

  if p_productos is null
     or jsonb_typeof(p_productos) <> 'array'
     or jsonb_array_length(p_productos) = 0 then
    raise exception 'Agrega al menos un producto al pedido.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_productos) as producto
    where trim(coalesce(producto ->> 'nombre_producto', '')) = ''
       or coalesce(nullif(producto ->> 'cantidad', '')::numeric, 0) <= 0
       or coalesce(nullif(producto ->> 'precio_pagina', '')::numeric, -1) < 0
  ) then
    raise exception 'Revisa el nombre, la cantidad y el precio de los productos.';
  end if;

  select
    coalesce(sum(
      coalesce(
        nullif(producto ->> 'precio_shein', '')::numeric,
        nullif(producto ->> 'precio_pagina', '')::numeric,
        0
      ) * coalesce(nullif(producto ->> 'cantidad', '')::numeric, 0)
    ), 0),
    coalesce(sum(
      coalesce(
        nullif(producto ->> 'precio_venta', '')::numeric,
        nullif(producto ->> 'precio_pagina', '')::numeric,
        0
      ) * coalesce(nullif(producto ->> 'cantidad', '')::numeric, 0)
    ), 0)
  into v_total_shein, v_total_cliente
  from jsonb_array_elements(p_productos) as producto;

  if v_anticipo < 0 then
    raise exception 'El anticipo no puede ser negativo.';
  end if;

  if v_anticipo > v_total_cliente then
    raise exception 'El anticipo no puede ser mayor al total del cliente.';
  end if;

  v_prefijo := case upper(trim(coalesce(p_plataforma, '')))
    when 'SHEIN' then 'SHN'
    when 'TEMU' then 'TEM'
    when 'ALIEXPRESS' then 'ALI'
    when 'CATÁLOGO' then 'CAT'
    when 'CATALOGO' then 'CAT'
    else 'ORD'
  end;

  v_codigo := v_prefijo
    || '-'
    || to_char(clock_timestamp(), 'YYMMDDHH24MISSMS')
    || '-'
    || upper(substr(md5(random()::text || clock_timestamp()::text || v_user_id::text), 1, 4));

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
  )
  values (
    v_user_id,
    p_cliente_id,
    v_codigo,
    coalesce(nullif(trim(p_plataforma), ''), 'SHEIN'),
    coalesce(nullif(trim(p_estado), ''), 'Cotizado'),
    round(v_total_shein, 2),
    round(v_total_cliente, 2),
    round(v_anticipo, 2),
    round(v_total_cliente - v_anticipo, 2),
    round(v_total_cliente - v_total_shein, 2),
    trim(coalesce(p_tracking, '')),
    trim(coalesce(p_notas, '')),
    coalesce(p_fecha_creacion, current_date)
  )
  returning * into v_pedido;

  insert into public.productos_pedido (
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
    v_pedido.id,
    trim(producto ->> 'nombre_producto'),
    trim(coalesce(producto ->> 'link_shein', '')),
    trim(coalesce(producto ->> 'talla', '')),
    trim(coalesce(producto ->> 'color', '')),
    coalesce(nullif(producto ->> 'cantidad', '')::integer, 1),
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
  from jsonb_array_elements(p_productos) as producto;

  if v_anticipo > 0 then
    insert into public.pagos (
      pedido_id,
      monto,
      metodo_pago,
      notas
    )
    values (
      v_pedido.id,
      round(v_anticipo, 2),
      'Anticipo',
      'Pago inicial'
    );
  end if;

  -- Sincronización inmediata para que el panel refleje el nuevo uso.
  update public.perfiles
  set pedidos_usados = v_pedidos_usados + 1
  where user_id = v_user_id;

  return to_jsonb(v_pedido);
end;
$$;


ALTER FUNCTION "public"."crear_pedido_completo"("p_cliente_id" "uuid", "p_plataforma" "text", "p_estado" "text", "p_tracking" "text", "p_notas" "text", "p_productos" "jsonb", "p_anticipo" numeric, "p_fecha_creacion" "date") OWNER TO "postgres";

--
-- Name: crear_perfil_al_registrar(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."crear_perfil_al_registrar"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.perfiles (
    user_id,
    nombre,
    correo,
    plan_actual,
    plan_origen,
    limite_pedidos,
    es_admin,
    cuenta_bloqueada,
    plataforma_predeterminada
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    new.email,
    'basico',
    'sistema',
    30,
    false,
    false,
    'SHEIN'
  )
  on conflict (user_id) do update
  set
    correo = excluded.correo,
    actualizado_en = now();

  return new;
end;
$$;


ALTER FUNCTION "public"."crear_perfil_al_registrar"() OWNER TO "postgres";

--
-- Name: es_admin_actual(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."es_admin_actual"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.perfiles
    where user_id = auth.uid()
      and es_admin is true
  );
$$;


ALTER FUNCTION "public"."es_admin_actual"() OWNER TO "postgres";

--
-- Name: estado_correo_registro("text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."estado_correo_registro"("p_correo" "text") RETURNS TABLE("existe" boolean, "confirmado" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
begin
  return query
  select
    exists (
      select 1
      from auth.users u
      where lower(u.email) = lower(trim(p_correo))
    ) as existe,
    exists (
      select 1
      from auth.users u
      where lower(u.email) = lower(trim(p_correo))
        and u.email_confirmed_at is not null
    ) as confirmado;
end;
$$;


ALTER FUNCTION "public"."estado_correo_registro"("p_correo" "text") OWNER TO "postgres";

--
-- Name: generar_codigo_pedido("text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."generar_codigo_pedido"("p_plataforma" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_user uuid := auth.uid();
  v_plataforma_raw text := coalesce(nullif(trim(p_plataforma), ''), 'Otro');
  v_norm text;
  v_plataforma text;
  v_prefix text;
  v_max_existente bigint := 0;
  v_siguiente bigint := 0;
begin
  if v_user is null then
    raise exception 'No autenticado';
  end if;

  v_norm := lower(translate(v_plataforma_raw, 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUaeiouu'));

  if v_norm like '%shein%' then
    v_plataforma := 'SHEIN';
    v_prefix := 'SHN';
  elsif v_norm like '%temu%' then
    v_plataforma := 'Temu';
    v_prefix := 'TEM';
  elsif v_norm like '%aliexpress%' or v_norm like '%ali express%' then
    v_plataforma := 'AliExpress';
    v_prefix := 'ALI';
  elsif v_norm like '%catalogo%' or v_norm like '%catálogo%' then
    v_plataforma := 'Catálogo';
    v_prefix := 'CAT';
  else
    v_plataforma := 'Otro';
    v_prefix := 'OTR';
  end if;

  select coalesce(max((substring(codigo from ('^' || v_prefix || '-([0-9]+)$')))::bigint), 0)
  into v_max_existente
  from public.pedidos
  where user_id = v_user
    and codigo ~ ('^' || v_prefix || '-[0-9]+$');

  insert into public.pedido_folios_usuario(user_id, plataforma, ultimo_numero)
  values (v_user, v_plataforma, v_max_existente)
  on conflict (user_id, plataforma)
  do update set
    ultimo_numero = greatest(public.pedido_folios_usuario.ultimo_numero, excluded.ultimo_numero),
    actualizado_en = now();

  update public.pedido_folios_usuario
  set ultimo_numero = ultimo_numero + 1,
      actualizado_en = now()
  where user_id = v_user
    and plataforma = v_plataforma
  returning ultimo_numero into v_siguiente;

  return v_prefix || '-' || v_siguiente;
end;
$_$;


ALTER FUNCTION "public"."generar_codigo_pedido"("p_plataforma" "text") OWNER TO "postgres";

--
-- Name: mi_estado_plan(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."mi_estado_plan"() RETURNS TABLE("user_id" "uuid", "nombre" "text", "correo" "text", "plan_actual" "text", "plan_origen" "text", "plan_expira_en" timestamp with time zone, "limite_pedidos" integer, "es_admin" boolean, "cuenta_bloqueada" boolean, "plataforma_predeterminada" "text", "pedidos_usados" bigint, "limite_alcanzado" boolean, "puede_crear_pedido" boolean, "puede_modificar" boolean, "plan_vencido" boolean)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user uuid;
  v_perfil public.perfiles%rowtype;
  v_intentos bigint;
  v_plan text;
  v_plan_vencido boolean;
  v_puede_crear boolean;
begin
  v_user := auth.uid();

  if v_user is null then
    return;
  end if;

  select * into v_perfil
  from public.perfiles
  where perfiles.user_id = v_user;

  if not found then
    return;
  end if;

  v_intentos := public.contar_intentos_pedidos(v_user);
  v_plan_vencido := v_perfil.plan_expira_en is not null and v_perfil.plan_expira_en < now();
  v_plan := case when v_plan_vencido then 'basico' else coalesce(v_perfil.plan_actual, 'basico') end;
  v_puede_crear := public.usuario_puede_crear_pedido(v_user);

  return query
  select
    v_perfil.user_id,
    v_perfil.nombre,
    v_perfil.correo,
    v_plan as plan_actual,
    v_perfil.plan_origen,
    v_perfil.plan_expira_en,
    v_perfil.limite_pedidos,
    v_perfil.es_admin,
    v_perfil.cuenta_bloqueada,
    v_perfil.plataforma_predeterminada,
    v_intentos as pedidos_usados,
    (v_plan = 'basico' and v_intentos >= coalesce(v_perfil.limite_pedidos, 30)) as limite_alcanzado,
    v_puede_crear,
    (
      not coalesce(v_perfil.cuenta_bloqueada, false)
      and (
        coalesce(v_perfil.es_admin, false)
        or v_plan in ('premium', 'pro')
        or (v_plan = 'basico' and v_intentos < coalesce(v_perfil.limite_pedidos, 30))
      )
    ) as puede_modificar,
    v_plan_vencido;
end;
$$;


ALTER FUNCTION "public"."mi_estado_plan"() OWNER TO "postgres";

--
-- Name: mis_suscripciones_recientes(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."mis_suscripciones_recientes"() RETURNS TABLE("id" "uuid", "plan" "text", "monto" numeric, "moneda" "text", "metodo_pago" "text", "estado_pago" "text", "fecha_inicio" timestamp with time zone, "fecha_fin" timestamp with time zone, "origen" "text", "creado_en" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform 1 from public.procesar_mi_plan_vencido();

  return query
  select
    s.id,
    s.plan,
    s.monto,
    s.moneda,
    s.metodo_pago,
    s.estado_pago,
    s.fecha_inicio,
    s.fecha_fin,
    s.origen,
    s.creado_en
  from public.suscripciones s
  where s.user_id = auth.uid()
  order by s.creado_en desc
  limit 5;
end;
$$;


ALTER FUNCTION "public"."mis_suscripciones_recientes"() OWNER TO "postgres";

--
-- Name: obtener_dias_estimados_plataforma("uuid", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."obtener_dias_estimados_plataforma"("p_user_id" "uuid", "p_plataforma" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_perfil public.perfiles;
  v_plataforma text := lower(coalesce(p_plataforma, 'SHEIN'));
begin
  select * into v_perfil from public.perfiles where user_id = p_user_id limit 1;

  if v_plataforma like '%temu%' then
    return coalesce(v_perfil.tiempo_temu_dias, 14);
  elsif v_plataforma like '%ali%' then
    return coalesce(v_perfil.tiempo_aliexpress_dias, 25);
  elsif v_plataforma like '%cat%' then
    return coalesce(v_perfil.tiempo_catalogo_dias, 7);
  elsif v_plataforma like '%otro%' then
    return coalesce(v_perfil.tiempo_otro_dias, 15);
  end if;

  return coalesce(v_perfil.tiempo_shein_dias, 10);
end;
$$;


ALTER FUNCTION "public"."obtener_dias_estimados_plataforma"("p_user_id" "uuid", "p_plataforma" "text") OWNER TO "postgres";

--
-- Name: ordely_es_admin(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."ordely_es_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce((select es_admin from public.perfiles where user_id = auth.uid()), false);
$$;


ALTER FUNCTION "public"."ordely_es_admin"() OWNER TO "postgres";

--
-- Name: ordely_sincronizar_pedidos_usados(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."ordely_sincronizar_pedidos_usados"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_user_id uuid;
begin
  if tg_op = 'DELETE' then
    v_user_id := old.user_id;
  else
    v_user_id := new.user_id;
  end if;

  if v_user_id is not null then
    update public.perfiles as perfil
    set pedidos_usados = (
      select count(*)::integer
      from public.pedidos as pedido
      where pedido.user_id = v_user_id
    )
    where perfil.user_id = v_user_id;
  end if;

  if tg_op = 'UPDATE'
     and old.user_id is distinct from new.user_id
     and old.user_id is not null then
    update public.perfiles as perfil
    set pedidos_usados = (
      select count(*)::integer
      from public.pedidos as pedido
      where pedido.user_id = old.user_id
    )
    where perfil.user_id = old.user_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."ordely_sincronizar_pedidos_usados"() OWNER TO "postgres";

--
-- Name: ordely_validar_creacion_nueva(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."ordely_validar_creacion_nueva"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v public.perfiles%rowtype;
begin
  select * into v from public.perfiles where user_id = auth.uid();
  if not found then return new; end if;

  if v.cuenta_bloqueada or v.estado_suscripcion = 'suspendida' then
    raise exception 'Tu cuenta está suspendida.';
  end if;

  if v.plan_expira_en is not null and v.plan_expira_en < now() then
    raise exception 'Tu periodo venció. Puedes editar pedidos actuales, pero no crear registros nuevos.';
  end if;

  if v.plan_actual = 'basico' and coalesce(v.pedidos_usados, 0) >= coalesce(v.limite_pedidos, 30) then
    raise exception 'Llegaste al límite de 30 pedidos. Renueva tu periodo para continuar.';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."ordely_validar_creacion_nueva"() OWNER TO "postgres";

--
-- Name: procesar_mi_plan_vencido(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."procesar_mi_plan_vencido"() RETURNS TABLE("perfiles_actualizados" integer, "suscripciones_vencidas" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user uuid;
  v_perfiles integer := 0;
  v_suscripciones integer := 0;
begin
  v_user := auth.uid();

  if v_user is null then
    return query select 0, 0;
    return;
  end if;

  -- Marcar suscripciones vencidas del usuario actual.
  update public.suscripciones
  set
    estado_pago = 'vencido',
    actualizado_en = now()
  where user_id = v_user
    and estado_pago = 'pagado'
    and fecha_fin is not null
    and fecha_fin < now();

  get diagnostics v_suscripciones = row_count;

  -- Regresar a Básico si su plan Premium/Pro ya venció.
  update public.perfiles
  set
    plan_actual = 'basico',
    plan_origen = 'sistema',
    plan_expira_en = null,
    limite_pedidos = 30,
    actualizado_en = now()
  where user_id = v_user
    and es_admin = false
    and plan_actual in ('premium', 'pro')
    and plan_expira_en is not null
    and plan_expira_en < now();

  get diagnostics v_perfiles = row_count;

  return query select v_perfiles, v_suscripciones;
end;
$$;


ALTER FUNCTION "public"."procesar_mi_plan_vencido"() OWNER TO "postgres";

--
-- Name: public_obtener_seguimiento("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."public_obtener_seguimiento"("p_token" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select jsonb_build_object(
    'codigo', p.codigo,
    'plataforma', p.plataforma,
    'estado', p.estado,
    'total_cliente', coalesce(p.total_cliente, 0),
    'anticipo', coalesce(p.anticipo, 0),
    'restante', coalesce(p.restante, 0),
    'tracking', p.tracking,
    'cliente_nombre', c.nombre,
    'productos', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'nombre_producto', pp.nombre_producto,
            'talla', pp.talla,
            'color', pp.color,
            'cantidad', pp.cantidad,
            'entregado', pp.entregado,
            'estado_compra', pp.estado_compra,
            'fecha_estimada_llegada', pp.fecha_estimada_llegada
          )
          order by pp.creado_en asc
        )
        from public.productos_pedido as pp
        where pp.pedido_id = p.id
      ),
      '[]'::jsonb
    )
  )
  from public.pedidos as p
  left join public.clientes as c
    on c.id = p.cliente_id
  where p.public_token::text = p_token::text
  limit 1;
$$;


ALTER FUNCTION "public"."public_obtener_seguimiento"("p_token" "uuid") OWNER TO "postgres";

--
-- Name: pedidos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."pedidos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "cliente_id" "uuid",
    "codigo" "text" NOT NULL,
    "estado" "text" DEFAULT 'Cotizado'::"text" NOT NULL,
    "fecha_pedido" "date" DEFAULT CURRENT_DATE,
    "total_shein" numeric(10,2) DEFAULT 0,
    "total_cliente" numeric(10,2) DEFAULT 0,
    "anticipo" numeric(10,2) DEFAULT 0,
    "restante" numeric(10,2) DEFAULT 0,
    "ganancia" numeric(10,2) DEFAULT 0,
    "tracking" "text",
    "notas" "text",
    "creado_en" timestamp with time zone DEFAULT "now"(),
    "plataforma" "text" DEFAULT 'SHEIN'::"text" NOT NULL,
    "public_token" "uuid" DEFAULT "gen_random_uuid"(),
    "reembolso" boolean DEFAULT false NOT NULL,
    "reembolso_monto" numeric DEFAULT 0 NOT NULL,
    "fecha_cotizado" timestamp with time zone DEFAULT "now"(),
    "fecha_confirmado" timestamp with time zone,
    "fecha_comprado" timestamp with time zone,
    "fecha_recibido" timestamp with time zone,
    "fecha_dejado_negocio" timestamp with time zone,
    "fecha_entregado" timestamp with time zone
);


ALTER TABLE "public"."pedidos" OWNER TO "postgres";

--
-- Name: recalcular_totales_pedido("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."recalcular_totales_pedido"("p_pedido_id" "uuid") RETURNS "public"."pedidos"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_pedido public.pedidos;
  v_total_plataforma numeric := 0;
  v_total_cliente numeric := 0;
  v_pagado numeric := 0;
  v_restante numeric := 0;
  v_ganancia numeric := 0;
begin
  if auth.uid() is null then
    raise exception 'No autorizado';
  end if;

  select * into v_pedido from public.pedidos where id = p_pedido_id;

  if not found then
    raise exception 'Pedido no encontrado';
  end if;

  select coalesce(sum(coalesce(costo_real_total, precio_shein * cantidad, 0)), 0)
  into v_total_plataforma
  from public.productos_pedido
  where pedido_id = p_pedido_id;

  select coalesce(sum(coalesce(precio_venta, 0) * coalesce(cantidad, 0)), 0)
  into v_total_cliente
  from public.productos_pedido
  where pedido_id = p_pedido_id;

  select coalesce(sum(coalesce(monto, 0)), 0)
  into v_pagado
  from public.pagos
  where pedido_id = p_pedido_id;

  v_restante := greatest(v_total_cliente - v_pagado, 0);
  v_ganancia := v_total_cliente - v_total_plataforma;

  update public.pedidos
  set
    total_shein = v_total_plataforma,
    total_cliente = v_total_cliente,
    anticipo = v_pagado,
    restante = v_restante,
    ganancia = v_ganancia
  where id = p_pedido_id
  returning * into v_pedido;

  return v_pedido;
end;
$$;


ALTER FUNCTION "public"."recalcular_totales_pedido"("p_pedido_id" "uuid") OWNER TO "postgres";

--
-- Name: registrar_intento_pedido_creado(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."registrar_intento_pedido_creado"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user uuid;
begin
  v_user := coalesce(new.user_id, auth.uid());

  if v_user is null then
    return new;
  end if;

  insert into public.pedidos_intentos (user_id, pedido_id, creado_en, origen)
  values (v_user, new.id, coalesce(new.fecha_cotizado, now()), 'pedido_creado')
  on conflict (pedido_id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."registrar_intento_pedido_creado"() OWNER TO "postgres";

--
-- Name: usuario_puede_crear_pedido("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."usuario_puede_crear_pedido"("p_user" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_perfil public.perfiles%rowtype;
  v_intentos bigint;
  v_plan text;
begin
  if p_user is null then
    return false;
  end if;

  select * into v_perfil
  from public.perfiles
  where user_id = p_user;

  if not found then
    return false;
  end if;

  if coalesce(v_perfil.cuenta_bloqueada, false) then
    return false;
  end if;

  if coalesce(v_perfil.es_admin, false) then
    return true;
  end if;

  v_plan := coalesce(v_perfil.plan_actual, 'basico');

  if v_perfil.plan_expira_en is not null and v_perfil.plan_expira_en < now() then
    v_plan := 'basico';
  end if;

  if v_plan in ('premium', 'pro') then
    return true;
  end if;

  v_intentos := public.contar_intentos_pedidos(p_user);

  return v_intentos < coalesce(v_perfil.limite_pedidos, 30);
end;
$$;


ALTER FUNCTION "public"."usuario_puede_crear_pedido"("p_user" "uuid") OWNER TO "postgres";

--
-- Name: clientes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."clientes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "telefono" "text",
    "direccion" "text",
    "notas" "text",
    "creado_en" timestamp with time zone DEFAULT "now"(),
    "medio_contacto" "text" DEFAULT 'WhatsApp'::"text",
    "usuario_contacto" "text" DEFAULT ''::"text"
);


ALTER TABLE "public"."clientes" OWNER TO "postgres";

--
-- Name: codigos_canjeados; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."codigos_canjeados" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "codigo" "text" NOT NULL,
    "plan_otorgado" "text" NOT NULL,
    "plan_expira_en" timestamp with time zone,
    "canjeado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "codigos_canjeados_plan_check" CHECK (("plan_otorgado" = ANY (ARRAY['premium'::"text", 'pro'::"text"])))
);


ALTER TABLE "public"."codigos_canjeados" OWNER TO "postgres";

--
-- Name: codigos_promocionales; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."codigos_promocionales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo" "text" NOT NULL,
    "plan" "text" NOT NULL,
    "duracion_dias" integer,
    "usos_maximos" integer,
    "usos_actuales" integer DEFAULT 0 NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "codigo_expira_en" timestamp with time zone,
    "notas" "text",
    "creado_por" "uuid",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "codigos_duracion_check" CHECK ((("duracion_dias" IS NULL) OR ("duracion_dias" > 0))),
    CONSTRAINT "codigos_plan_check" CHECK (("plan" = ANY (ARRAY['premium'::"text", 'pro'::"text"]))),
    CONSTRAINT "codigos_usos_actuales_check" CHECK (("usos_actuales" >= 0)),
    CONSTRAINT "codigos_usos_check" CHECK ((("usos_maximos" IS NULL) OR ("usos_maximos" > 0)))
);


ALTER TABLE "public"."codigos_promocionales" OWNER TO "postgres";

--
-- Name: comentarios_soporte; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."comentarios_soporte" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "nombre" "text",
    "correo" "text",
    "tipo" "text" NOT NULL,
    "asunto" "text" NOT NULL,
    "mensaje" "text" NOT NULL,
    "pagina" "text",
    "calificacion" integer,
    "estado" "text" DEFAULT 'Nuevo'::"text" NOT NULL,
    "prioridad" "text" DEFAULT 'Normal'::"text" NOT NULL,
    "notas_admin" "text",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resuelto_en" timestamp with time zone,
    CONSTRAINT "comentarios_soporte_asunto_longitud_check" CHECK ((("char_length"("btrim"("asunto")) >= 4) AND ("char_length"("btrim"("asunto")) <= 120))),
    CONSTRAINT "comentarios_soporte_calificacion_check" CHECK ((("calificacion" IS NULL) OR (("calificacion" >= 1) AND ("calificacion" <= 5)))),
    CONSTRAINT "comentarios_soporte_estado_check" CHECK (("estado" = ANY (ARRAY['Nuevo'::"text", 'En revisión'::"text", 'Respondido'::"text", 'Resuelto'::"text", 'Descartado'::"text"]))),
    CONSTRAINT "comentarios_soporte_mensaje_longitud_check" CHECK ((("char_length"("btrim"("mensaje")) >= 10) AND ("char_length"("btrim"("mensaje")) <= 2000))),
    CONSTRAINT "comentarios_soporte_notas_longitud_check" CHECK ((("notas_admin" IS NULL) OR ("char_length"("notas_admin") <= 2000))),
    CONSTRAINT "comentarios_soporte_prioridad_check" CHECK (("prioridad" = ANY (ARRAY['Baja'::"text", 'Normal'::"text", 'Alta'::"text", 'Urgente'::"text"]))),
    CONSTRAINT "comentarios_soporte_tipo_check" CHECK (("tipo" = ANY (ARRAY['Sugerencia'::"text", 'Problema técnico'::"text", 'Pregunta'::"text", 'Opinión'::"text", 'Solicitud de función'::"text"])))
);


ALTER TABLE "public"."comentarios_soporte" OWNER TO "postgres";

--
-- Name: lote_productos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."lote_productos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lote_id" "uuid" NOT NULL,
    "producto_pedido_id" "uuid" NOT NULL,
    "pedido_id" "uuid" NOT NULL,
    "precio_pagina_unitario" numeric DEFAULT 0 NOT NULL,
    "cantidad" numeric DEFAULT 1 NOT NULL,
    "subtotal_pagina" numeric DEFAULT 0 NOT NULL,
    "participa_cupon" boolean DEFAULT true NOT NULL,
    "descuento_asignado" numeric DEFAULT 0 NOT NULL,
    "envio_asignado" numeric DEFAULT 0 NOT NULL,
    "comision_asignada" numeric DEFAULT 0 NOT NULL,
    "costo_real_total" numeric DEFAULT 0 NOT NULL,
    "costo_real_unitario" numeric DEFAULT 0 NOT NULL,
    "ganancia_total" numeric DEFAULT 0 NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "puntos_asignados" numeric DEFAULT 0 NOT NULL,
    "importacion_asignada" numeric DEFAULT 0 NOT NULL,
    "impuesto_asignado" numeric DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."lote_productos" OWNER TO "postgres";

--
-- Name: pagos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."pagos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "pedido_id" "uuid",
    "monto" numeric(10,2) NOT NULL,
    "metodo_pago" "text",
    "fecha_pago" "date" DEFAULT CURRENT_DATE,
    "notas" "text",
    "creado_en" timestamp with time zone DEFAULT "now"(),
    "tipo" "text" DEFAULT 'pago'::"text" NOT NULL
);


ALTER TABLE "public"."pagos" OWNER TO "postgres";

--
-- Name: pedido_contadores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."pedido_contadores" (
    "user_id" "uuid" NOT NULL,
    "plataforma" "text" NOT NULL,
    "ultimo_numero" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."pedido_contadores" OWNER TO "postgres";

--
-- Name: pedido_folios_usuario; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."pedido_folios_usuario" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "plataforma" "text" NOT NULL,
    "ultimo_numero" bigint DEFAULT 0 NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pedido_folios_usuario" OWNER TO "postgres";

--
-- Name: pedidos_intentos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."pedidos_intentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "pedido_id" "uuid",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "origen" "text" DEFAULT 'pedido_creado'::"text" NOT NULL
);


ALTER TABLE "public"."pedidos_intentos" OWNER TO "postgres";

--
-- Name: perfiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."perfiles" (
    "user_id" "uuid" NOT NULL,
    "nombre" "text",
    "correo" "text",
    "plan_actual" "text" DEFAULT 'basico'::"text" NOT NULL,
    "plan_origen" "text" DEFAULT 'sistema'::"text" NOT NULL,
    "plan_expira_en" timestamp with time zone,
    "limite_pedidos" integer DEFAULT 30 NOT NULL,
    "es_admin" boolean DEFAULT false NOT NULL,
    "cuenta_bloqueada" boolean DEFAULT false NOT NULL,
    "plataforma_predeterminada" "text" DEFAULT 'SHEIN'::"text" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tiempo_shein_dias" integer DEFAULT 10,
    "tiempo_temu_dias" integer DEFAULT 14,
    "tiempo_aliexpress_dias" integer DEFAULT 25,
    "tiempo_catalogo_dias" integer DEFAULT 7,
    "tiempo_otro_dias" integer DEFAULT 15,
    "negocio_nombre" "text",
    "negocio_direccion" "text",
    "negocio_horario" "text",
    "fecha_formato" "text" DEFAULT 'dd/mm/yyyy'::"text",
    "fecha_mostrar_anio" boolean DEFAULT true,
    "pedidos_separar_por_fecha" boolean DEFAULT true,
    "estado_suscripcion" "text" DEFAULT 'activa'::"text" NOT NULL,
    "periodo_inicia_en" timestamp with time zone,
    "suscripcion_cancelada_en" timestamp with time zone,
    "nota_admin" "text",
    "pedidos_usados" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "perfiles_estado_suscripcion_check" CHECK (("estado_suscripcion" = ANY (ARRAY['prueba'::"text", 'activa'::"text", 'vencida'::"text", 'cancelada'::"text", 'suspendida'::"text", 'gratis'::"text"]))),
    CONSTRAINT "perfiles_plan_actual_check" CHECK (("plan_actual" = ANY (ARRAY['basico'::"text", 'premium'::"text", 'pro'::"text"]))),
    CONSTRAINT "perfiles_plan_origen_check" CHECK (("plan_origen" = ANY (ARRAY['sistema'::"text", 'manual'::"text", 'codigo'::"text", 'pago'::"text", 'regalo'::"text"]))),
    CONSTRAINT "perfiles_plataforma_check" CHECK (("plataforma_predeterminada" = ANY (ARRAY['SHEIN'::"text", 'Temu'::"text", 'AliExpress'::"text", 'Catálogo'::"text", 'Otro'::"text"])))
);


ALTER TABLE "public"."perfiles" OWNER TO "postgres";

--
-- Name: suscripciones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."suscripciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "plan" "text" NOT NULL,
    "monto" numeric(10,2) DEFAULT 0 NOT NULL,
    "moneda" "text" DEFAULT 'MXN'::"text" NOT NULL,
    "metodo_pago" "text" DEFAULT 'manual'::"text" NOT NULL,
    "estado_pago" "text" DEFAULT 'pagado'::"text" NOT NULL,
    "fecha_inicio" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fecha_fin" timestamp with time zone,
    "origen" "text" DEFAULT 'manual'::"text" NOT NULL,
    "notas" "text",
    "creado_por" "uuid",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "suscripciones_estado_pago_check" CHECK (("estado_pago" = ANY (ARRAY['pendiente'::"text", 'pagado'::"text", 'cancelado'::"text", 'vencido'::"text", 'reembolsado'::"text"]))),
    CONSTRAINT "suscripciones_origen_check" CHECK (("origen" = ANY (ARRAY['manual'::"text", 'codigo'::"text", 'pago'::"text", 'stripe'::"text", 'mercado_pago'::"text", 'regalo'::"text"]))),
    CONSTRAINT "suscripciones_plan_check" CHECK (("plan" = ANY (ARRAY['premium'::"text", 'pro'::"text"])))
);


ALTER TABLE "public"."suscripciones" OWNER TO "postgres";

--
-- Name: clientes clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_pkey" PRIMARY KEY ("id");


--
-- Name: codigos_canjeados codigos_canjeados_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."codigos_canjeados"
    ADD CONSTRAINT "codigos_canjeados_pkey" PRIMARY KEY ("id");


--
-- Name: codigos_canjeados codigos_canjeados_unico_usuario_codigo; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."codigos_canjeados"
    ADD CONSTRAINT "codigos_canjeados_unico_usuario_codigo" UNIQUE ("codigo_id", "user_id");


--
-- Name: codigos_promocionales codigos_promocionales_codigo_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."codigos_promocionales"
    ADD CONSTRAINT "codigos_promocionales_codigo_key" UNIQUE ("codigo");


--
-- Name: codigos_promocionales codigos_promocionales_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."codigos_promocionales"
    ADD CONSTRAINT "codigos_promocionales_pkey" PRIMARY KEY ("id");


--
-- Name: comentarios_soporte comentarios_soporte_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."comentarios_soporte"
    ADD CONSTRAINT "comentarios_soporte_pkey" PRIMARY KEY ("id");


--
-- Name: lote_productos lote_productos_lote_id_producto_pedido_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."lote_productos"
    ADD CONSTRAINT "lote_productos_lote_id_producto_pedido_id_key" UNIQUE ("lote_id", "producto_pedido_id");


--
-- Name: lote_productos lote_productos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."lote_productos"
    ADD CONSTRAINT "lote_productos_pkey" PRIMARY KEY ("id");


--
-- Name: lotes_compra lotes_compra_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."lotes_compra"
    ADD CONSTRAINT "lotes_compra_pkey" PRIMARY KEY ("id");


--
-- Name: pagos pagos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."pagos"
    ADD CONSTRAINT "pagos_pkey" PRIMARY KEY ("id");


--
-- Name: pedido_contadores pedido_contadores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."pedido_contadores"
    ADD CONSTRAINT "pedido_contadores_pkey" PRIMARY KEY ("user_id", "plataforma");


--
-- Name: pedido_folios_usuario pedido_folios_usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."pedido_folios_usuario"
    ADD CONSTRAINT "pedido_folios_usuario_pkey" PRIMARY KEY ("id");


--
-- Name: pedido_folios_usuario pedido_folios_usuario_user_id_plataforma_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."pedido_folios_usuario"
    ADD CONSTRAINT "pedido_folios_usuario_user_id_plataforma_key" UNIQUE ("user_id", "plataforma");


--
-- Name: pedidos_intentos pedidos_intentos_pedido_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."pedidos_intentos"
    ADD CONSTRAINT "pedidos_intentos_pedido_id_unique" UNIQUE ("pedido_id");


--
-- Name: pedidos_intentos pedidos_intentos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."pedidos_intentos"
    ADD CONSTRAINT "pedidos_intentos_pkey" PRIMARY KEY ("id");


--
-- Name: pedidos pedidos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."pedidos"
    ADD CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id");


--
-- Name: perfiles perfiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_pkey" PRIMARY KEY ("user_id");


--
-- Name: productos_pedido productos_pedido_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."productos_pedido"
    ADD CONSTRAINT "productos_pedido_pkey" PRIMARY KEY ("id");


--
-- Name: suscripciones suscripciones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."suscripciones"
    ADD CONSTRAINT "suscripciones_pkey" PRIMARY KEY ("id");


--
-- Name: clientes_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "clientes_user_id_idx" ON "public"."clientes" USING "btree" ("user_id");


--
-- Name: comentarios_soporte_creado_en_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "comentarios_soporte_creado_en_idx" ON "public"."comentarios_soporte" USING "btree" ("creado_en" DESC);


--
-- Name: comentarios_soporte_estado_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "comentarios_soporte_estado_idx" ON "public"."comentarios_soporte" USING "btree" ("estado");


--
-- Name: comentarios_soporte_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "comentarios_soporte_user_id_idx" ON "public"."comentarios_soporte" USING "btree" ("user_id");


--
-- Name: idx_clientes_creado_en; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_clientes_creado_en" ON "public"."clientes" USING "btree" ("creado_en" DESC);


--
-- Name: idx_clientes_medio_contacto; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_clientes_medio_contacto" ON "public"."clientes" USING "btree" ("medio_contacto");


--
-- Name: idx_clientes_nombre; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_clientes_nombre" ON "public"."clientes" USING "btree" ("nombre");


--
-- Name: idx_clientes_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_clientes_user_id" ON "public"."clientes" USING "btree" ("user_id");


--
-- Name: idx_clientes_usuario_contacto; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_clientes_usuario_contacto" ON "public"."clientes" USING "btree" ("usuario_contacto");


--
-- Name: idx_codigos_canjeados_codigo_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_codigos_canjeados_codigo_id" ON "public"."codigos_canjeados" USING "btree" ("codigo_id");


--
-- Name: idx_codigos_canjeados_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_codigos_canjeados_user_id" ON "public"."codigos_canjeados" USING "btree" ("user_id");


--
-- Name: idx_codigos_promocionales_codigo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_codigos_promocionales_codigo" ON "public"."codigos_promocionales" USING "btree" ("codigo");


--
-- Name: idx_lote_productos_lote_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_lote_productos_lote_id" ON "public"."lote_productos" USING "btree" ("lote_id");


--
-- Name: idx_lote_productos_producto_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_lote_productos_producto_id" ON "public"."lote_productos" USING "btree" ("producto_pedido_id");


--
-- Name: idx_lotes_compra_costos_extra_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_lotes_compra_costos_extra_fecha" ON "public"."lotes_compra" USING "btree" ("user_id", "fecha_compra" DESC, "envio", "importacion", "impuestos", "comisiones");


--
-- Name: idx_lotes_compra_user_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_lotes_compra_user_fecha" ON "public"."lotes_compra" USING "btree" ("user_id", "fecha_compra" DESC);


--
-- Name: idx_lotes_compra_user_fecha_v6; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_lotes_compra_user_fecha_v6" ON "public"."lotes_compra" USING "btree" ("user_id", "fecha_compra" DESC);


--
-- Name: idx_lotes_compra_user_plataforma_fecha_v6; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_lotes_compra_user_plataforma_fecha_v6" ON "public"."lotes_compra" USING "btree" ("user_id", "plataforma", "fecha_compra" DESC);


--
-- Name: idx_ordely_clientes_direccion_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ordely_clientes_direccion_trgm" ON "public"."clientes" USING "gin" ("direccion" "public"."gin_trgm_ops");


--
-- Name: idx_ordely_clientes_nombre_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ordely_clientes_nombre_trgm" ON "public"."clientes" USING "gin" ("nombre" "public"."gin_trgm_ops");


--
-- Name: idx_ordely_clientes_notas_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ordely_clientes_notas_trgm" ON "public"."clientes" USING "gin" ("notas" "public"."gin_trgm_ops");


--
-- Name: idx_ordely_clientes_telefono_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ordely_clientes_telefono_trgm" ON "public"."clientes" USING "gin" ("telefono" "public"."gin_trgm_ops");


--
-- Name: idx_ordely_clientes_user_creado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ordely_clientes_user_creado" ON "public"."clientes" USING "btree" ("user_id", "creado_en" DESC);


--
-- Name: idx_ordely_pedidos_cliente; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ordely_pedidos_cliente" ON "public"."pedidos" USING "btree" ("cliente_id");


--
-- Name: idx_ordely_pedidos_codigo_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ordely_pedidos_codigo_trgm" ON "public"."pedidos" USING "gin" ("codigo" "public"."gin_trgm_ops");


--
-- Name: idx_ordely_pedidos_user_creado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ordely_pedidos_user_creado" ON "public"."pedidos" USING "btree" ("user_id", "creado_en" DESC);


--
-- Name: idx_ordely_pedidos_user_estado_creado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ordely_pedidos_user_estado_creado" ON "public"."pedidos" USING "btree" ("user_id", "estado", "creado_en" DESC);


--
-- Name: idx_ordely_pedidos_user_plataforma_creado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ordely_pedidos_user_plataforma_creado" ON "public"."pedidos" USING "btree" ("user_id", "plataforma", "creado_en" DESC);


--
-- Name: idx_pagos_fecha_pago; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_pagos_fecha_pago" ON "public"."pagos" USING "btree" ("fecha_pago" DESC);


--
-- Name: idx_pagos_pedido_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_pagos_pedido_id" ON "public"."pagos" USING "btree" ("pedido_id");


--
-- Name: idx_pedido_folios_usuario_user_plataforma; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_pedido_folios_usuario_user_plataforma" ON "public"."pedido_folios_usuario" USING "btree" ("user_id", "plataforma");


--
-- Name: idx_pedidos_cliente_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_pedidos_cliente_id" ON "public"."pedidos" USING "btree" ("cliente_id");


--
-- Name: idx_pedidos_creado_en; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_pedidos_creado_en" ON "public"."pedidos" USING "btree" ("creado_en" DESC);


--
-- Name: idx_pedidos_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_pedidos_estado" ON "public"."pedidos" USING "btree" ("estado");


--
-- Name: idx_pedidos_intentos_creado_en; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_pedidos_intentos_creado_en" ON "public"."pedidos_intentos" USING "btree" ("creado_en" DESC);


--
-- Name: idx_pedidos_intentos_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_pedidos_intentos_user_id" ON "public"."pedidos_intentos" USING "btree" ("user_id");


--
-- Name: idx_pedidos_plataforma; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_pedidos_plataforma" ON "public"."pedidos" USING "btree" ("plataforma");


--
-- Name: idx_pedidos_public_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_pedidos_public_token" ON "public"."pedidos" USING "btree" ("public_token");


--
-- Name: idx_pedidos_user_codigo_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "idx_pedidos_user_codigo_unique" ON "public"."pedidos" USING "btree" ("user_id", "codigo") WHERE (("user_id" IS NOT NULL) AND ("codigo" IS NOT NULL));


--
-- Name: idx_pedidos_user_creado_en; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_pedidos_user_creado_en" ON "public"."pedidos" USING "btree" ("user_id", "creado_en" DESC);


--
-- Name: idx_pedidos_user_fecha_pedido; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_pedidos_user_fecha_pedido" ON "public"."pedidos" USING "btree" ("user_id", "fecha_pedido" DESC);


--
-- Name: idx_pedidos_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_pedidos_user_id" ON "public"."pedidos" USING "btree" ("user_id");


--
-- Name: idx_productos_pedido_entregado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_productos_pedido_entregado" ON "public"."productos_pedido" USING "btree" ("entregado");


--
-- Name: idx_productos_pedido_estado_compra; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_productos_pedido_estado_compra" ON "public"."productos_pedido" USING "btree" ("estado_compra");


--
-- Name: idx_productos_pedido_fecha_estimada; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_productos_pedido_fecha_estimada" ON "public"."productos_pedido" USING "btree" ("fecha_estimada_llegada");


--
-- Name: idx_productos_pedido_lote_compra_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_productos_pedido_lote_compra_id" ON "public"."productos_pedido" USING "btree" ("lote_compra_id");


--
-- Name: idx_productos_pedido_nombre_producto; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_productos_pedido_nombre_producto" ON "public"."productos_pedido" USING "btree" ("nombre_producto");


--
-- Name: idx_productos_pedido_pedido_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_productos_pedido_pedido_id" ON "public"."productos_pedido" USING "btree" ("pedido_id");


--
-- Name: pagos_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "pagos_user_id_idx" ON "public"."pagos" USING "btree" ("user_id");


--
-- Name: pedidos_public_token_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "pedidos_public_token_unique" ON "public"."pedidos" USING "btree" ("public_token");


--
-- Name: pedidos_user_codigo_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "pedidos_user_codigo_unique" ON "public"."pedidos" USING "btree" ("user_id", "codigo");


--
-- Name: pedidos_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "pedidos_user_id_idx" ON "public"."pedidos" USING "btree" ("user_id");


--
-- Name: productos_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "productos_user_id_idx" ON "public"."productos_pedido" USING "btree" ("user_id");


--
-- Name: suscripciones_creado_en_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "suscripciones_creado_en_idx" ON "public"."suscripciones" USING "btree" ("creado_en" DESC);


--
-- Name: suscripciones_estado_pago_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "suscripciones_estado_pago_idx" ON "public"."suscripciones" USING "btree" ("estado_pago");


--
-- Name: suscripciones_fecha_fin_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "suscripciones_fecha_fin_idx" ON "public"."suscripciones" USING "btree" ("fecha_fin");


--
-- Name: suscripciones_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "suscripciones_user_id_idx" ON "public"."suscripciones" USING "btree" ("user_id");


--
-- Name: lotes_compra ordely_bloquear_compra_nueva; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "ordely_bloquear_compra_nueva" BEFORE INSERT ON "public"."lotes_compra" FOR EACH ROW EXECUTE FUNCTION "public"."ordely_validar_creacion_nueva"();


--
-- Name: pedidos ordely_bloquear_pedido_nuevo; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "ordely_bloquear_pedido_nuevo" BEFORE INSERT ON "public"."pedidos" FOR EACH ROW EXECUTE FUNCTION "public"."ordely_validar_creacion_nueva"();


--
-- Name: pedidos ordely_sincronizar_pedidos_usados_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "ordely_sincronizar_pedidos_usados_trigger" AFTER INSERT OR DELETE OR UPDATE OF "user_id" ON "public"."pedidos" FOR EACH ROW EXECUTE FUNCTION "public"."ordely_sincronizar_pedidos_usados"();


--
-- Name: pedidos trigger_bloquear_crear_pedido_si_limite; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trigger_bloquear_crear_pedido_si_limite" BEFORE INSERT ON "public"."pedidos" FOR EACH ROW EXECUTE FUNCTION "public"."bloquear_crear_pedido_si_limite"();


--
-- Name: pedidos trigger_registrar_intento_pedido_creado; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trigger_registrar_intento_pedido_creado" AFTER INSERT ON "public"."pedidos" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_intento_pedido_creado"();


--
-- Name: codigos_canjeados codigos_canjeados_codigo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."codigos_canjeados"
    ADD CONSTRAINT "codigos_canjeados_codigo_id_fkey" FOREIGN KEY ("codigo_id") REFERENCES "public"."codigos_promocionales"("id") ON DELETE CASCADE;


--
-- Name: codigos_canjeados codigos_canjeados_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."codigos_canjeados"
    ADD CONSTRAINT "codigos_canjeados_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: codigos_promocionales codigos_promocionales_creado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."codigos_promocionales"
    ADD CONSTRAINT "codigos_promocionales_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: comentarios_soporte comentarios_soporte_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."comentarios_soporte"
    ADD CONSTRAINT "comentarios_soporte_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: lote_productos lote_productos_lote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."lote_productos"
    ADD CONSTRAINT "lote_productos_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes_compra"("id") ON DELETE CASCADE;


--
-- Name: lote_productos lote_productos_pedido_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."lote_productos"
    ADD CONSTRAINT "lote_productos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE CASCADE;


--
-- Name: lote_productos lote_productos_producto_pedido_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."lote_productos"
    ADD CONSTRAINT "lote_productos_producto_pedido_id_fkey" FOREIGN KEY ("producto_pedido_id") REFERENCES "public"."productos_pedido"("id") ON DELETE CASCADE;


--
-- Name: pagos pagos_pedido_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."pagos"
    ADD CONSTRAINT "pagos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE CASCADE;


--
-- Name: pedidos pedidos_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."pedidos"
    ADD CONSTRAINT "pedidos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE SET NULL;


--
-- Name: pedidos_intentos pedidos_intentos_pedido_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."pedidos_intentos"
    ADD CONSTRAINT "pedidos_intentos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE SET NULL;


--
-- Name: perfiles perfiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: productos_pedido productos_pedido_lote_compra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."productos_pedido"
    ADD CONSTRAINT "productos_pedido_lote_compra_id_fkey" FOREIGN KEY ("lote_compra_id") REFERENCES "public"."lotes_compra"("id") ON DELETE SET NULL;


--
-- Name: productos_pedido productos_pedido_pedido_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."productos_pedido"
    ADD CONSTRAINT "productos_pedido_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE CASCADE;


--
-- Name: suscripciones suscripciones_creado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."suscripciones"
    ADD CONSTRAINT "suscripciones_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "auth"."users"("id");


--
-- Name: suscripciones suscripciones_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."suscripciones"
    ADD CONSTRAINT "suscripciones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: pedido_folios_usuario Usuarios actualizan sus folios; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Usuarios actualizan sus folios" ON "public"."pedido_folios_usuario" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: lote_productos Usuarios ven productos de sus lotes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Usuarios ven productos de sus lotes" ON "public"."lote_productos" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."lotes_compra" "lc"
  WHERE (("lc"."id" = "lote_productos"."lote_id") AND ("lc"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."lotes_compra" "lc"
  WHERE (("lc"."id" = "lote_productos"."lote_id") AND ("lc"."user_id" = "auth"."uid"())))));


--
-- Name: pedido_folios_usuario Usuarios ven sus folios; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Usuarios ven sus folios" ON "public"."pedido_folios_usuario" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));


--
-- Name: lotes_compra Usuarios ven sus lotes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Usuarios ven sus lotes" ON "public"."lotes_compra" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));


--
-- Name: codigos_canjeados canjes_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "canjes_admin_select" ON "public"."codigos_canjeados" FOR SELECT TO "authenticated" USING ("public"."es_admin_actual"());


--
-- Name: codigos_canjeados canjes_user_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "canjes_user_select_own" ON "public"."codigos_canjeados" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));


--
-- Name: clientes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."clientes" ENABLE ROW LEVEL SECURITY;

--
-- Name: clientes clientes_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "clientes_delete_own" ON "public"."clientes" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));


--
-- Name: clientes clientes_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "clientes_insert_own" ON "public"."clientes" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: clientes clientes_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "clientes_select_own" ON "public"."clientes" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));


--
-- Name: clientes clientes_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "clientes_update_own" ON "public"."clientes" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: codigos_promocionales codigos_admin_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "codigos_admin_delete" ON "public"."codigos_promocionales" FOR DELETE TO "authenticated" USING ("public"."es_admin_actual"());


--
-- Name: codigos_promocionales codigos_admin_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "codigos_admin_insert" ON "public"."codigos_promocionales" FOR INSERT TO "authenticated" WITH CHECK ("public"."es_admin_actual"());


--
-- Name: codigos_promocionales codigos_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "codigos_admin_select" ON "public"."codigos_promocionales" FOR SELECT TO "authenticated" USING ("public"."es_admin_actual"());


--
-- Name: codigos_promocionales codigos_admin_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "codigos_admin_update" ON "public"."codigos_promocionales" FOR UPDATE TO "authenticated" USING ("public"."es_admin_actual"()) WITH CHECK ("public"."es_admin_actual"());


--
-- Name: codigos_canjeados; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."codigos_canjeados" ENABLE ROW LEVEL SECURITY;

--
-- Name: codigos_promocionales; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."codigos_promocionales" ENABLE ROW LEVEL SECURITY;

--
-- Name: comentarios_soporte; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."comentarios_soporte" ENABLE ROW LEVEL SECURITY;

--
-- Name: comentarios_soporte comentarios_soporte_actualizar_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "comentarios_soporte_actualizar_admin" ON "public"."comentarios_soporte" FOR UPDATE TO "authenticated" USING ("public"."es_admin_actual"()) WITH CHECK ("public"."es_admin_actual"());


--
-- Name: comentarios_soporte comentarios_soporte_eliminar_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "comentarios_soporte_eliminar_admin" ON "public"."comentarios_soporte" FOR DELETE TO "authenticated" USING ("public"."es_admin_actual"());


--
-- Name: comentarios_soporte comentarios_soporte_insertar_propios; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "comentarios_soporte_insertar_propios" ON "public"."comentarios_soporte" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: comentarios_soporte comentarios_soporte_ver_propios_o_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "comentarios_soporte_ver_propios_o_admin" ON "public"."comentarios_soporte" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR "public"."es_admin_actual"()));


--
-- Name: pedido_contadores contadores_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "contadores_insert_own" ON "public"."pedido_contadores" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: pedido_contadores contadores_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "contadores_select_own" ON "public"."pedido_contadores" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));


--
-- Name: pedido_contadores contadores_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "contadores_update_own" ON "public"."pedido_contadores" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: lote_productos; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."lote_productos" ENABLE ROW LEVEL SECURITY;

--
-- Name: lotes_compra; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."lotes_compra" ENABLE ROW LEVEL SECURITY;

--
-- Name: pagos; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."pagos" ENABLE ROW LEVEL SECURITY;

--
-- Name: pagos pagos_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "pagos_delete_own" ON "public"."pagos" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));


--
-- Name: pagos pagos_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "pagos_insert_own" ON "public"."pagos" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: pagos pagos_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "pagos_select_own" ON "public"."pagos" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));


--
-- Name: pagos pagos_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "pagos_update_own" ON "public"."pagos" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: pedido_contadores; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."pedido_contadores" ENABLE ROW LEVEL SECURITY;

--
-- Name: pedido_folios_usuario; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."pedido_folios_usuario" ENABLE ROW LEVEL SECURITY;

--
-- Name: pedidos; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."pedidos" ENABLE ROW LEVEL SECURITY;

--
-- Name: pedidos pedidos_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "pedidos_delete_own" ON "public"."pedidos" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));


--
-- Name: pedidos pedidos_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "pedidos_insert_own" ON "public"."pedidos" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: pedidos_intentos; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."pedidos_intentos" ENABLE ROW LEVEL SECURITY;

--
-- Name: pedidos pedidos_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "pedidos_select_own" ON "public"."pedidos" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));


--
-- Name: pedidos pedidos_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "pedidos_update_own" ON "public"."pedidos" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: perfiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."perfiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: perfiles perfiles_delete_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "perfiles_delete_admin" ON "public"."perfiles" FOR DELETE TO "authenticated" USING ("public"."es_admin_actual"());


--
-- Name: perfiles perfiles_insert_self; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "perfiles_insert_self" ON "public"."perfiles" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));


--
-- Name: perfiles perfiles_select_self_or_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "perfiles_select_self_or_admin" ON "public"."perfiles" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."es_admin_actual"()));


--
-- Name: perfiles perfiles_update_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "perfiles_update_admin" ON "public"."perfiles" FOR UPDATE TO "authenticated" USING ("public"."es_admin_actual"()) WITH CHECK ("public"."es_admin_actual"());


--
-- Name: productos_pedido productos_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "productos_delete_own" ON "public"."productos_pedido" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));


--
-- Name: productos_pedido productos_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "productos_insert_own" ON "public"."productos_pedido" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: productos_pedido; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."productos_pedido" ENABLE ROW LEVEL SECURITY;

--
-- Name: productos_pedido productos_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "productos_select_own" ON "public"."productos_pedido" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));


--
-- Name: productos_pedido productos_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "productos_update_own" ON "public"."productos_pedido" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: suscripciones; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."suscripciones" ENABLE ROW LEVEL SECURITY;

--
-- Name: suscripciones suscripciones_delete_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "suscripciones_delete_admin" ON "public"."suscripciones" FOR DELETE TO "authenticated" USING ("public"."es_admin_actual"());


--
-- Name: suscripciones suscripciones_insert_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "suscripciones_insert_admin" ON "public"."suscripciones" FOR INSERT TO "authenticated" WITH CHECK ("public"."es_admin_actual"());


--
-- Name: suscripciones suscripciones_select_own_or_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "suscripciones_select_own_or_admin" ON "public"."suscripciones" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."es_admin_actual"()));


--
-- Name: suscripciones suscripciones_update_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "suscripciones_update_admin" ON "public"."suscripciones" FOR UPDATE TO "authenticated" USING ("public"."es_admin_actual"()) WITH CHECK ("public"."es_admin_actual"());


--
-- Name: SCHEMA "public"; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


--
-- Name: TABLE "productos_pedido"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."productos_pedido" TO "anon";
GRANT ALL ON TABLE "public"."productos_pedido" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_pedido" TO "service_role";


--
-- Name: FUNCTION "actualizar_estado_producto_logistica"("p_producto_id" "uuid", "p_estado" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."actualizar_estado_producto_logistica"("p_producto_id" "uuid", "p_estado" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."actualizar_estado_producto_logistica"("p_producto_id" "uuid", "p_estado" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."actualizar_estado_producto_logistica"("p_producto_id" "uuid", "p_estado" "text") TO "service_role";


--
-- Name: FUNCTION "actualizar_mi_plataforma"("p_plataforma" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."actualizar_mi_plataforma"("p_plataforma" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."actualizar_mi_plataforma"("p_plataforma" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."actualizar_mi_plataforma"("p_plataforma" "text") TO "service_role";


--
-- Name: FUNCTION "admin_actualizar_estado_suscripcion"("p_suscripcion_id" "uuid", "p_estado_pago" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."admin_actualizar_estado_suscripcion"("p_suscripcion_id" "uuid", "p_estado_pago" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_actualizar_estado_suscripcion"("p_suscripcion_id" "uuid", "p_estado_pago" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_actualizar_estado_suscripcion"("p_suscripcion_id" "uuid", "p_estado_pago" "text") TO "service_role";


--
-- Name: FUNCTION "admin_agregar_dias_usuario"("p_user_id" "uuid", "p_dias" integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."admin_agregar_dias_usuario"("p_user_id" "uuid", "p_dias" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_agregar_dias_usuario"("p_user_id" "uuid", "p_dias" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_agregar_dias_usuario"("p_user_id" "uuid", "p_dias" integer) TO "service_role";


--
-- Name: FUNCTION "admin_bloquear_usuario"("p_user_id" "uuid", "p_bloqueada" boolean); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."admin_bloquear_usuario"("p_user_id" "uuid", "p_bloqueada" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_bloquear_usuario"("p_user_id" "uuid", "p_bloqueada" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_bloquear_usuario"("p_user_id" "uuid", "p_bloqueada" boolean) TO "service_role";


--
-- Name: FUNCTION "admin_cambiar_estado_codigo"("p_codigo_id" "uuid", "p_activo" boolean); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."admin_cambiar_estado_codigo"("p_codigo_id" "uuid", "p_activo" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_cambiar_estado_codigo"("p_codigo_id" "uuid", "p_activo" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_cambiar_estado_codigo"("p_codigo_id" "uuid", "p_activo" boolean) TO "service_role";


--
-- Name: FUNCTION "admin_cambiar_plan_usuario"("p_user_id" "uuid", "p_plan" "text", "p_duracion_dias" integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."admin_cambiar_plan_usuario"("p_user_id" "uuid", "p_plan" "text", "p_duracion_dias" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_cambiar_plan_usuario"("p_user_id" "uuid", "p_plan" "text", "p_duracion_dias" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_cambiar_plan_usuario"("p_user_id" "uuid", "p_plan" "text", "p_duracion_dias" integer) TO "service_role";


--
-- Name: FUNCTION "admin_cancelar_suscripcion_usuario"("p_user_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."admin_cancelar_suscripcion_usuario"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_cancelar_suscripcion_usuario"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_cancelar_suscripcion_usuario"("p_user_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "admin_crear_codigo"("p_codigo" "text", "p_plan" "text", "p_duracion_dias" integer, "p_usos_maximos" integer, "p_codigo_expira_en" timestamp with time zone, "p_notas" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."admin_crear_codigo"("p_codigo" "text", "p_plan" "text", "p_duracion_dias" integer, "p_usos_maximos" integer, "p_codigo_expira_en" timestamp with time zone, "p_notas" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_crear_codigo"("p_codigo" "text", "p_plan" "text", "p_duracion_dias" integer, "p_usos_maximos" integer, "p_codigo_expira_en" timestamp with time zone, "p_notas" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_crear_codigo"("p_codigo" "text", "p_plan" "text", "p_duracion_dias" integer, "p_usos_maximos" integer, "p_codigo_expira_en" timestamp with time zone, "p_notas" "text") TO "service_role";


--
-- Name: FUNCTION "admin_listar_codigos"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."admin_listar_codigos"() TO "anon";
GRANT ALL ON FUNCTION "public"."admin_listar_codigos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_listar_codigos"() TO "service_role";


--
-- Name: FUNCTION "admin_listar_suscripciones"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."admin_listar_suscripciones"() TO "anon";
GRANT ALL ON FUNCTION "public"."admin_listar_suscripciones"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_listar_suscripciones"() TO "service_role";


--
-- Name: FUNCTION "admin_procesar_planes_vencidos"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."admin_procesar_planes_vencidos"() TO "anon";
GRANT ALL ON FUNCTION "public"."admin_procesar_planes_vencidos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_procesar_planes_vencidos"() TO "service_role";


--
-- Name: FUNCTION "admin_registrar_pago_manual"("p_user_id" "uuid", "p_plan" "text", "p_monto" numeric, "p_metodo_pago" "text", "p_duracion_dias" integer, "p_sin_vencimiento" boolean, "p_notas" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."admin_registrar_pago_manual"("p_user_id" "uuid", "p_plan" "text", "p_monto" numeric, "p_metodo_pago" "text", "p_duracion_dias" integer, "p_sin_vencimiento" boolean, "p_notas" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_registrar_pago_manual"("p_user_id" "uuid", "p_plan" "text", "p_monto" numeric, "p_metodo_pago" "text", "p_duracion_dias" integer, "p_sin_vencimiento" boolean, "p_notas" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_registrar_pago_manual"("p_user_id" "uuid", "p_plan" "text", "p_monto" numeric, "p_metodo_pago" "text", "p_duracion_dias" integer, "p_sin_vencimiento" boolean, "p_notas" "text") TO "service_role";


--
-- Name: FUNCTION "admin_renovar_periodo_usuario"("p_user_id" "uuid", "p_dias" integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."admin_renovar_periodo_usuario"("p_user_id" "uuid", "p_dias" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_renovar_periodo_usuario"("p_user_id" "uuid", "p_dias" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_renovar_periodo_usuario"("p_user_id" "uuid", "p_dias" integer) TO "service_role";


--
-- Name: FUNCTION "admin_usuarios_resumen"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."admin_usuarios_resumen"() TO "anon";
GRANT ALL ON FUNCTION "public"."admin_usuarios_resumen"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_usuarios_resumen"() TO "service_role";


--
-- Name: FUNCTION "bloquear_crear_pedido_si_limite"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."bloquear_crear_pedido_si_limite"() TO "anon";
GRANT ALL ON FUNCTION "public"."bloquear_crear_pedido_si_limite"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."bloquear_crear_pedido_si_limite"() TO "service_role";


--
-- Name: FUNCTION "canjear_codigo"("p_codigo" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."canjear_codigo"("p_codigo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."canjear_codigo"("p_codigo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."canjear_codigo"("p_codigo" "text") TO "service_role";


--
-- Name: FUNCTION "contar_intentos_pedidos"("p_user" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."contar_intentos_pedidos"("p_user" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."contar_intentos_pedidos"("p_user" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."contar_intentos_pedidos"("p_user" "uuid") TO "service_role";


--
-- Name: FUNCTION "correo_ya_registrado"("p_correo" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."correo_ya_registrado"("p_correo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."correo_ya_registrado"("p_correo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."correo_ya_registrado"("p_correo" "text") TO "service_role";


--
-- Name: TABLE "lotes_compra"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."lotes_compra" TO "anon";
GRANT ALL ON TABLE "public"."lotes_compra" TO "authenticated";
GRANT ALL ON TABLE "public"."lotes_compra" TO "service_role";


--
-- Name: FUNCTION "crear_lote_compra"("p_plataforma" "text", "p_numero_orden" "text", "p_cupon" "text", "p_descuento_cupon" numeric, "p_puntos" numeric, "p_envio" numeric, "p_importacion" numeric, "p_impuestos" numeric, "p_comisiones" numeric, "p_total_pagado" numeric, "p_fecha_compra" "date", "p_productos" "uuid"[]); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."crear_lote_compra"("p_plataforma" "text", "p_numero_orden" "text", "p_cupon" "text", "p_descuento_cupon" numeric, "p_puntos" numeric, "p_envio" numeric, "p_importacion" numeric, "p_impuestos" numeric, "p_comisiones" numeric, "p_total_pagado" numeric, "p_fecha_compra" "date", "p_productos" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."crear_lote_compra"("p_plataforma" "text", "p_numero_orden" "text", "p_cupon" "text", "p_descuento_cupon" numeric, "p_puntos" numeric, "p_envio" numeric, "p_importacion" numeric, "p_impuestos" numeric, "p_comisiones" numeric, "p_total_pagado" numeric, "p_fecha_compra" "date", "p_productos" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."crear_lote_compra"("p_plataforma" "text", "p_numero_orden" "text", "p_cupon" "text", "p_descuento_cupon" numeric, "p_puntos" numeric, "p_envio" numeric, "p_importacion" numeric, "p_impuestos" numeric, "p_comisiones" numeric, "p_total_pagado" numeric, "p_fecha_compra" "date", "p_productos" "uuid"[]) TO "service_role";


--
-- Name: FUNCTION "crear_pedido_completo"("p_cliente_id" "uuid", "p_plataforma" "text", "p_estado" "text", "p_tracking" "text", "p_notas" "text", "p_productos" "jsonb", "p_anticipo" numeric, "p_fecha_creacion" "date"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."crear_pedido_completo"("p_cliente_id" "uuid", "p_plataforma" "text", "p_estado" "text", "p_tracking" "text", "p_notas" "text", "p_productos" "jsonb", "p_anticipo" numeric, "p_fecha_creacion" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."crear_pedido_completo"("p_cliente_id" "uuid", "p_plataforma" "text", "p_estado" "text", "p_tracking" "text", "p_notas" "text", "p_productos" "jsonb", "p_anticipo" numeric, "p_fecha_creacion" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."crear_pedido_completo"("p_cliente_id" "uuid", "p_plataforma" "text", "p_estado" "text", "p_tracking" "text", "p_notas" "text", "p_productos" "jsonb", "p_anticipo" numeric, "p_fecha_creacion" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."crear_pedido_completo"("p_cliente_id" "uuid", "p_plataforma" "text", "p_estado" "text", "p_tracking" "text", "p_notas" "text", "p_productos" "jsonb", "p_anticipo" numeric, "p_fecha_creacion" "date") TO "service_role";


--
-- Name: FUNCTION "crear_perfil_al_registrar"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."crear_perfil_al_registrar"() TO "anon";
GRANT ALL ON FUNCTION "public"."crear_perfil_al_registrar"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."crear_perfil_al_registrar"() TO "service_role";


--
-- Name: FUNCTION "es_admin_actual"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."es_admin_actual"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."es_admin_actual"() TO "anon";
GRANT ALL ON FUNCTION "public"."es_admin_actual"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."es_admin_actual"() TO "service_role";


--
-- Name: FUNCTION "estado_correo_registro"("p_correo" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."estado_correo_registro"("p_correo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."estado_correo_registro"("p_correo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."estado_correo_registro"("p_correo" "text") TO "service_role";


--
-- Name: FUNCTION "generar_codigo_pedido"("p_plataforma" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."generar_codigo_pedido"("p_plataforma" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generar_codigo_pedido"("p_plataforma" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generar_codigo_pedido"("p_plataforma" "text") TO "service_role";


--
-- Name: FUNCTION "mi_estado_plan"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."mi_estado_plan"() TO "anon";
GRANT ALL ON FUNCTION "public"."mi_estado_plan"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mi_estado_plan"() TO "service_role";


--
-- Name: FUNCTION "mis_suscripciones_recientes"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."mis_suscripciones_recientes"() TO "anon";
GRANT ALL ON FUNCTION "public"."mis_suscripciones_recientes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mis_suscripciones_recientes"() TO "service_role";


--
-- Name: FUNCTION "obtener_dias_estimados_plataforma"("p_user_id" "uuid", "p_plataforma" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."obtener_dias_estimados_plataforma"("p_user_id" "uuid", "p_plataforma" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."obtener_dias_estimados_plataforma"("p_user_id" "uuid", "p_plataforma" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."obtener_dias_estimados_plataforma"("p_user_id" "uuid", "p_plataforma" "text") TO "service_role";


--
-- Name: FUNCTION "ordely_es_admin"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."ordely_es_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."ordely_es_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ordely_es_admin"() TO "service_role";


--
-- Name: FUNCTION "ordely_sincronizar_pedidos_usados"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."ordely_sincronizar_pedidos_usados"() TO "anon";
GRANT ALL ON FUNCTION "public"."ordely_sincronizar_pedidos_usados"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ordely_sincronizar_pedidos_usados"() TO "service_role";


--
-- Name: FUNCTION "ordely_validar_creacion_nueva"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."ordely_validar_creacion_nueva"() TO "anon";
GRANT ALL ON FUNCTION "public"."ordely_validar_creacion_nueva"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ordely_validar_creacion_nueva"() TO "service_role";


--
-- Name: FUNCTION "procesar_mi_plan_vencido"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."procesar_mi_plan_vencido"() TO "anon";
GRANT ALL ON FUNCTION "public"."procesar_mi_plan_vencido"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."procesar_mi_plan_vencido"() TO "service_role";


--
-- Name: FUNCTION "public_obtener_seguimiento"("p_token" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."public_obtener_seguimiento"("p_token" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."public_obtener_seguimiento"("p_token" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."public_obtener_seguimiento"("p_token" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."public_obtener_seguimiento"("p_token" "uuid") TO "service_role";


--
-- Name: TABLE "pedidos"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."pedidos" TO "anon";
GRANT ALL ON TABLE "public"."pedidos" TO "authenticated";
GRANT ALL ON TABLE "public"."pedidos" TO "service_role";


--
-- Name: FUNCTION "recalcular_totales_pedido"("p_pedido_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."recalcular_totales_pedido"("p_pedido_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recalcular_totales_pedido"("p_pedido_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalcular_totales_pedido"("p_pedido_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "registrar_intento_pedido_creado"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."registrar_intento_pedido_creado"() TO "anon";
GRANT ALL ON FUNCTION "public"."registrar_intento_pedido_creado"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_intento_pedido_creado"() TO "service_role";


--
-- Name: FUNCTION "usuario_puede_crear_pedido"("p_user" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."usuario_puede_crear_pedido"("p_user" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."usuario_puede_crear_pedido"("p_user" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."usuario_puede_crear_pedido"("p_user" "uuid") TO "service_role";


--
-- Name: TABLE "clientes"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."clientes" TO "anon";
GRANT ALL ON TABLE "public"."clientes" TO "authenticated";
GRANT ALL ON TABLE "public"."clientes" TO "service_role";


--
-- Name: TABLE "codigos_canjeados"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."codigos_canjeados" TO "anon";
GRANT ALL ON TABLE "public"."codigos_canjeados" TO "authenticated";
GRANT ALL ON TABLE "public"."codigos_canjeados" TO "service_role";


--
-- Name: TABLE "codigos_promocionales"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."codigos_promocionales" TO "anon";
GRANT ALL ON TABLE "public"."codigos_promocionales" TO "authenticated";
GRANT ALL ON TABLE "public"."codigos_promocionales" TO "service_role";


--
-- Name: TABLE "comentarios_soporte"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."comentarios_soporte" TO "authenticated";
GRANT ALL ON TABLE "public"."comentarios_soporte" TO "service_role";


--
-- Name: TABLE "lote_productos"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."lote_productos" TO "anon";
GRANT ALL ON TABLE "public"."lote_productos" TO "authenticated";
GRANT ALL ON TABLE "public"."lote_productos" TO "service_role";


--
-- Name: TABLE "pagos"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."pagos" TO "anon";
GRANT ALL ON TABLE "public"."pagos" TO "authenticated";
GRANT ALL ON TABLE "public"."pagos" TO "service_role";


--
-- Name: TABLE "pedido_contadores"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."pedido_contadores" TO "anon";
GRANT ALL ON TABLE "public"."pedido_contadores" TO "authenticated";
GRANT ALL ON TABLE "public"."pedido_contadores" TO "service_role";


--
-- Name: TABLE "pedido_folios_usuario"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."pedido_folios_usuario" TO "anon";
GRANT ALL ON TABLE "public"."pedido_folios_usuario" TO "authenticated";
GRANT ALL ON TABLE "public"."pedido_folios_usuario" TO "service_role";


--
-- Name: TABLE "pedidos_intentos"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."pedidos_intentos" TO "anon";
GRANT ALL ON TABLE "public"."pedidos_intentos" TO "authenticated";
GRANT ALL ON TABLE "public"."pedidos_intentos" TO "service_role";


--
-- Name: TABLE "perfiles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."perfiles" TO "anon";
GRANT ALL ON TABLE "public"."perfiles" TO "authenticated";
GRANT ALL ON TABLE "public"."perfiles" TO "service_role";


--
-- Name: TABLE "suscripciones"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."suscripciones" TO "anon";
GRANT ALL ON TABLE "public"."suscripciones" TO "authenticated";
GRANT ALL ON TABLE "public"."suscripciones" TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- PostgreSQL database dump complete
--

-- \unrestrict AIH7CG2s5eiTLjeWDziQvpWHSVoUTKNyZgtj4k8WI4tT8GI8cA44tOihwF8GvcF
