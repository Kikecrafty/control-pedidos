-- Corrige la carga del registro compuesto usado al canjear días de referidos.
-- La versión anterior seleccionaba el registro como una sola columna compuesta,
-- lo que PostgreSQL intentaba asignar al primer campo UUID del rowtype.

begin;

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

revoke all on function public.canjear_mis_dias_referidos_v1(uuid) from public, anon;
grant execute on function public.canjear_mis_dias_referidos_v1(uuid) to authenticated;

commit;
