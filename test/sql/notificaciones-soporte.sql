\set ON_ERROR_STOP on

begin;

do $$
declare
  v_admin uuid := '00000000-0000-4000-8000-000000000301';
  v_usuario uuid := '00000000-0000-4000-8000-000000000302';
  v_otro uuid := '00000000-0000-4000-8000-000000000303';
  v_comentario_usuario uuid := '00000000-0000-4000-8000-000000000311';
  v_comentario_otro uuid := '00000000-0000-4000-8000-000000000312';
  v_notificacion_1 uuid;
  v_notificacion_2 uuid;
  v_notificacion_otro uuid;
  v_bloqueado boolean := false;
begin
  insert into auth.users(id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values
    (v_admin, 'authenticated', 'authenticated', 'admin-notificaciones@ordely.test', '{}'::jsonb, now(), now()),
    (v_usuario, 'authenticated', 'authenticated', 'usuario-notificaciones@ordely.test', '{}'::jsonb, now(), now()),
    (v_otro, 'authenticated', 'authenticated', 'otro-notificaciones@ordely.test', '{}'::jsonb, now(), now())
  on conflict (id) do nothing;

  insert into public.perfiles(user_id, nombre, correo, es_admin)
  values
    (v_admin, 'Admin notificaciones', 'admin-notificaciones@ordely.test', true),
    (v_usuario, 'Usuario notificaciones', 'usuario-notificaciones@ordely.test', false),
    (v_otro, 'Otro usuario', 'otro-notificaciones@ordely.test', false)
  on conflict (user_id) do update set es_admin = excluded.es_admin;

  insert into public.comentarios_soporte (
    id, user_id, nombre, correo, tipo, asunto, mensaje
  ) values
    (
      v_comentario_usuario, v_usuario, 'Usuario notificaciones',
      'usuario-notificaciones@ordely.test', 'Pregunta', 'Ayuda con pedido',
      'Necesito ayuda para revisar el estado de mi pedido.'
    ),
    (
      v_comentario_otro, v_otro, 'Otro usuario',
      'otro-notificaciones@ordely.test', 'Sugerencia', 'Mejora de pantalla',
      'Quiero sugerir una mejora para la pantalla principal.'
    )
  on conflict (id) do nothing;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  v_notificacion_1 := public.admin_enviar_notificacion_soporte_v1(
    v_comentario_usuario,
    'Ya revisamos tu solicitud y tenemos una respuesta para ti.'
  );
  v_notificacion_2 := public.admin_enviar_notificacion_soporte_v1(
    v_comentario_usuario,
    'Puedes continuar con tu pedido desde Ordely.'
  );
  v_notificacion_otro := public.admin_enviar_notificacion_soporte_v1(
    v_comentario_otro,
    'Gracias por compartir tu sugerencia.'
  );

  if not exists (
    select 1 from public.notificaciones_usuario
    where id = v_notificacion_1
      and user_id = v_usuario
      and comentario_id = v_comentario_usuario
      and leida_en is null
  ) then
    raise exception 'La notificacion no se asigno a la cuenta correcta';
  end if;

  perform set_config('request.jwt.claim.sub', v_usuario::text, true);
  perform public.marcar_mi_notificacion_leida_v1(v_notificacion_1);

  if not exists (
    select 1 from public.notificaciones_usuario
    where id = v_notificacion_1 and leida_en is not null
  ) then
    raise exception 'La notificacion individual no se marco como leida';
  end if;

  v_bloqueado := false;
  begin
    perform public.marcar_mi_notificacion_leida_v1(v_notificacion_otro);
  exception when others then
    v_bloqueado := position('Notificación no encontrada' in sqlerrm) > 0;
  end;

  if not v_bloqueado then
    raise exception 'Un usuario pudo modificar la notificacion de otra cuenta';
  end if;

  if public.marcar_mis_notificaciones_leidas_v1() <> 1 then
    raise exception 'No se marco la cantidad esperada de notificaciones';
  end if;

  v_bloqueado := false;
  begin
    perform public.admin_enviar_notificacion_soporte_v1(
      v_comentario_usuario,
      'Este mensaje no debe enviarse.'
    );
  exception when others then
    v_bloqueado := position('Acceso no autorizado' in sqlerrm) > 0;
  end;

  if not v_bloqueado then
    raise exception 'Un usuario normal pudo enviar una notificacion administrativa';
  end if;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform public.admin_enviar_notificacion_soporte_v1(
    v_comentario_usuario,
    'Tienes un nuevo mensaje pendiente en Ordely.'
  );

  if not exists (
    select 1 from public.admin_auditoria
    where accion = 'notificacion_soporte_enviada'
      and usuario_afectado_id = v_usuario
  ) then
    raise exception 'El envio no quedo registrado en auditoria';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000302', true);
set local role authenticated;

select 1 / case
  when (select count(*) from public.notificaciones_usuario) = 3
   and (select count(*) from public.notificaciones_usuario where leida_en is null) = 1
   and not exists (
     select 1 from public.notificaciones_usuario
     where user_id <> '00000000-0000-4000-8000-000000000302'::uuid
   )
  then 1 else 0
end as rls_notificaciones_correcto;

reset role;
rollback;

\echo 'OK: notificaciones de soporte, permisos y RLS verificados'
