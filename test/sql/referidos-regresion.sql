\set ON_ERROR_STOP on

begin;

do $$
declare
  v_admin uuid := '00000000-0000-4000-8000-000000000001';
  v_promotor uuid := '00000000-0000-4000-8000-000000000002';
  v_promotor_b uuid := '00000000-0000-4000-8000-000000000003';
  v_invitado_20 uuid := '00000000-0000-4000-8000-000000000101';
  v_invitado_21 uuid := '00000000-0000-4000-8000-000000000102';
  v_invitado_b uuid := '00000000-0000-4000-8000-000000000103';
  v_suscripcion_20 uuid := '00000000-0000-4000-8000-000000000201';
  v_suscripcion_21 uuid := '00000000-0000-4000-8000-000000000202';
  v_codigo text;
  v_referido_20 uuid;
  v_referido_21 uuid;
  v_recompensa_20 uuid;
  v_retiro uuid;
  v_resultado jsonb;
  v_bloqueado boolean := false;
  v_unicos integer;
  i integer;
begin
  insert into auth.users(id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values
    (v_admin, 'authenticated', 'authenticated', 'admin-auditoria@ordely.test', '{}'::jsonb, now(), now()),
    (v_promotor, 'authenticated', 'authenticated', 'promotor-auditoria@ordely.test', '{}'::jsonb, now(), now()),
    (v_promotor_b, 'authenticated', 'authenticated', 'promotor-b-auditoria@ordely.test', '{}'::jsonb, now(), now())
  on conflict (id) do nothing;

  insert into public.perfiles(user_id, nombre, correo, es_admin)
  values
    (v_admin, 'Admin auditoria', 'admin-auditoria@ordely.test', true),
    (v_promotor, 'Promotor auditoria', 'promotor-auditoria@ordely.test', false),
    (v_promotor_b, 'Promotor B auditoria', 'promotor-b-auditoria@ordely.test', false)
  on conflict (user_id) do update
  set es_admin = excluded.es_admin;

  v_codigo := public.ordely_codigo_referido(v_promotor);

  insert into public.referidos_programas(user_id, codigo, estado)
  values
    (v_promotor, v_codigo, 'activo'),
    (v_promotor_b, public.ordely_codigo_referido(v_promotor_b), 'activo')
  on conflict (user_id) do update
  set codigo = excluded.codigo,
      estado = 'activo';

  if char_length(v_codigo) <> 20 then
    raise exception 'El codigo de referido no tiene la longitud esperada';
  end if;

  if not public.validar_codigo_referido_v1(v_codigo)
     or public.validar_codigo_referido_v1('ORD-AAAAAAAAAAAAAAAA') then
    raise exception 'La validacion publica del codigo no respondio correctamente';
  end if;

  if not has_function_privilege('anon', 'public.validar_codigo_referido_v1(text)', 'execute')
     or has_function_privilege('anon', 'public.ordely_codigo_referido(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.referidos_cancelar_recompensas_v1(uuid,text)', 'execute') then
    raise exception 'Los permisos de las funciones de referidos no son seguros';
  end if;

  select count(distinct public.ordely_codigo_referido(gen_random_uuid()))::integer
  into v_unicos
  from generate_series(1, 100000);

  if v_unicos <> 100000 then
    raise exception 'Se detectaron codigos repetidos en la muestra de 100000';
  end if;

  for i in 10..28 loop
    insert into auth.users(id, aud, role, email, raw_user_meta_data, created_at, updated_at)
    values (
      ('00000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
      'authenticated',
      'authenticated',
      format('historico-%s@ordely.test', i),
      '{}'::jsonb,
      now(),
      now()
    ) on conflict (id) do nothing;

    insert into public.perfiles(user_id, nombre, correo)
    values (
      ('00000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
      format('Historico %s', i),
      format('historico-%s@ordely.test', i)
    ) on conflict (user_id) do nothing;

    insert into public.referidos(
      promotor_user_id, invitado_user_id, codigo_usado, estado,
      plan_comprado, precio_base, aprobado_en
    ) values (
      v_promotor,
      ('00000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
      v_codigo,
      'aprobado',
      'premium',
      79.00,
      now()
    );
  end loop;

  insert into auth.users(id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values
    (v_invitado_20, 'authenticated', 'authenticated', 'invitado-20@ordely.test', jsonb_build_object('codigo_referido', v_codigo), now(), now()),
    (v_invitado_21, 'authenticated', 'authenticated', 'invitado-21@ordely.test', jsonb_build_object('codigo_referido', v_codigo), now(), now()),
    (v_invitado_b, 'authenticated', 'authenticated', 'invitado-b@ordely.test', '{}'::jsonb, now(), now())
  on conflict (id) do nothing;

  insert into public.perfiles(user_id, nombre, correo)
  values
    (v_invitado_20, 'Invitado 20', 'invitado-20@ordely.test'),
    (v_invitado_21, 'Invitado 21', 'invitado-21@ordely.test'),
    (v_invitado_b, 'Invitado B', 'invitado-b@ordely.test')
  on conflict (user_id) do nothing;

  select id into v_referido_20
  from public.referidos
  where invitado_user_id = v_invitado_20;

  select id into v_referido_21
  from public.referidos
  where invitado_user_id = v_invitado_21;

  if v_referido_20 is null or v_referido_21 is null then
    raise exception 'El codigo no vinculo automaticamente las cuentas nuevas';
  end if;

  insert into public.referidos(
    promotor_user_id, invitado_user_id, codigo_usado, estado,
    plan_comprado, precio_base, aprobado_en
  ) values (
    v_promotor_b,
    v_invitado_b,
    public.ordely_codigo_referido(v_promotor_b),
    'aprobado',
    'pro',
    129.00,
    now()
  );

  insert into public.suscripciones(
    id, user_id, plan, monto, estado_pago, fecha_inicio, fecha_fin, origen
  ) values
    (v_suscripcion_20, v_invitado_20, 'premium', 59.99, 'pagado', now() - interval '31 days', now() - interval '1 day', 'pago'),
    (v_suscripcion_21, v_invitado_21, 'premium', 59.99, 'pagado', now() - interval '31 days', now() - interval '1 day', 'pago');

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  v_resultado := public.admin_aprobar_referido_v1(v_referido_20, 'Prueba automatizada');
  if (v_resultado->>'numero_referido')::integer <> 20
     or (v_resultado->>'porcentaje_comision')::numeric <> 20
     or (v_resultado->>'comision_mxn')::numeric <> 15.80 then
    raise exception 'La recompensa del referido 20 es incorrecta: %', v_resultado;
  end if;

  v_resultado := public.admin_aprobar_referido_v1(v_referido_21, 'Prueba automatizada');
  if (v_resultado->>'numero_referido')::integer <> 21
     or (v_resultado->>'porcentaje_comision')::numeric <> 20
     or (v_resultado->>'comision_mxn')::numeric <> 15.80 then
    raise exception 'La recompensa del referido 21 es incorrecta: %', v_resultado;
  end if;

  select id into v_recompensa_20
  from public.referidos_recompensas
  where referido_id = v_referido_20 and tipo = 'dias_premium';

  perform set_config('request.jwt.claim.sub', v_promotor::text, true);
  v_resultado := public.solicitar_pago_referidos_v1();
  v_retiro := (v_resultado->>'retiro_id')::uuid;

  if (v_resultado->>'monto_mxn')::numeric <> 31.60 then
    raise exception 'El retiro conjunto no suma 31.60: %', v_resultado;
  end if;

  update public.suscripciones
  set estado_pago = 'reembolsado'
  where id = v_suscripcion_20;

  if not exists (
    select 1 from public.referidos_retiros
    where id = v_retiro and estado = 'solicitado' and monto_mxn = 15.80
  ) then
    raise exception 'El retiro no se recalculo despues del primer reembolso';
  end if;

  if not exists (
    select 1 from public.referidos
    where id = v_referido_20 and estado = 'revision'
  ) or exists (
    select 1 from public.referidos_recompensas
    where referido_id = v_referido_20 and estado in ('disponible', 'solicitado')
  ) then
    raise exception 'El primer reembolso no cancelo correctamente sus recompensas';
  end if;

  begin
    perform public.canjear_mis_dias_referidos_v1(v_recompensa_20);
  exception when others then
    v_bloqueado := true;
  end;

  if not v_bloqueado then
    raise exception 'Fue posible canjear una recompensa reembolsada';
  end if;

  update public.suscripciones
  set estado_pago = 'reembolsado'
  where id = v_suscripcion_21;

  if not exists (
    select 1 from public.referidos_retiros
    where id = v_retiro and estado = 'cancelado'
  ) then
    raise exception 'El retiro no se cancelo al perder todas sus comisiones';
  end if;

  if (
    select count(*) from public.referidos_recompensas
    where referido_id in (v_referido_20, v_referido_21) and estado = 'cancelado'
  ) <> 4 then
    raise exception 'No se cancelaron las cuatro recompensas esperadas';
  end if;

  v_bloqueado := false;
  begin
    perform public.admin_resolver_solicitud_referidos_v1(v_promotor, true, null);
  exception when others then
    v_bloqueado := position('Acceso no autorizado' in sqlerrm) > 0;
  end;

  if not v_bloqueado then
    raise exception 'Un usuario normal pudo ejecutar una funcion administrativa';
  end if;

  perform public.marcar_mi_bienvenida_vista_v1('ordely-bienvenida-v1');
  if not exists (
    select 1 from public.perfiles
    where user_id = v_promotor and bienvenida_flujo_id = 'ordely-bienvenida-v1'
  ) then
    raise exception 'La bienvenida no se guardo para la cuenta correcta';
  end if;

  if exists (
    select 1 from public.perfiles
    where user_id = v_promotor_b and bienvenida_flujo_id is not null
  ) then
    raise exception 'La bienvenida de una cuenta afecto a otra';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
set local role authenticated;

select 1 / case
  when (select count(*) from public.referidos) = 21
   and not exists (
     select 1 from public.referidos
     where promotor_user_id = '00000000-0000-4000-8000-000000000003'::uuid
   )
  then 1 else 0
end as rls_aislamiento_correcto;

reset role;
set local role anon;

select 1 / case when public.validar_codigo_referido_v1(
  'ORD-' || upper(substr(md5('00000000-0000-4000-8000-000000000002:ordely-referidos'), 1, 16))
) then 1 else 0 end as validacion_anonima_correcta;

reset role;

rollback;

\echo 'OK: regresion de referidos, reembolsos, permisos, RLS y bienvenida completada'
