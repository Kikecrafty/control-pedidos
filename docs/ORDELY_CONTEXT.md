# Contexto técnico de Ordely

Actualizado: 15 de julio de 2026.

## Estado general

El programa `Recomienda y gana` está activo. Usa códigos por
cuenta y 30 días de validación. El acceso requiere una solicitud del usuario y
aprobación administrativa antes de mostrar el enlace personal. Cada referido válido entrega 15 días Premium
del 1 al 9; 30 días Premium del 10 al 49; 15 días Pro del 50 al 74; 30 días Pro
del 75 al 99; y Pro ilimitado al llegar a 100. Las comisiones comienzan en 20%,
suben de diez en diez y se detienen en 60%, siempre sobre los precios base de
$79 Premium y $129 Pro. La migración
`20260715010000_programa_referidos.sql` ya fue aplicada en Supabase.

El respaldo estable anterior corresponde a la versión `1.0.0`. La versión
`1.0.1` se desplegó el 14 de julio de 2026 en Supabase, GitHub y Cloudflare.
La rama `codex/integridad-pedidos-v1-1` fue la rama de preparación y conserva
ese identificador interno para coincidir con las migraciones ya registradas.
El frontend administra clientes, pedidos, productos, pagos, lotes,
suscripciones, códigos promocionales y soporte.

En Compras existe un modo opcional de costos manuales por producto. Está pensado
para carritos que también contienen artículos ajenos a pedidos: conserva el
costo real escrito para cada producto del negocio y evita repartir sobre ellos
el cupón correspondiente al carrito completo. Los costos se editan en la
revisión final de la compra, junto al precio anterior y al ahorro calculado.

La versión `1.1.0`, publicada el 15 de julio de 2026, parte de la aplicación `1.0.2` y reúne la bienvenida inicial, la navegación
adaptable, las llegadas agrupadas, el detalle de productos, las compras
agrupadas, el nuevo panel administrativo y la presentación comercial de
planes. También incorpora el programa de referidos con validación previa de
códigos y cancelación de recompensas pendientes ante cancelaciones o
reembolsos. La migración `20260714230000_admin_registro_real.sql` ya fue aplicada
en Supabase y pasó sus comprobaciones posteriores.

La bienvenida se identifica por versión y, con la migración
`20260715020000_bienvenida_por_cuenta.sql`, su estado queda guardado por cuenta
en `perfiles`. El navegador se conserva como respaldo temporal y permite
migrar silenciosamente las cuentas que ya habían completado la guía. Esta
migración ya fue aplicada en Supabase.

Después de cada actualización pública, Ordely puede mostrar una ventana de
novedades con agregados, funciones modificadas, elementos removidos y
correcciones visibles para el usuario. Se identifica por versión y se guarda de
forma independiente para cada cuenta. La migración local
`20260715180000_novedades_por_cuenta.sql` debe aplicarse en Supabase antes de
publicar este nuevo comportamiento; mientras tanto, el navegador funciona como
respaldo y evita repetir el aviso en el mismo dispositivo.

Inicio muestra la versión pública actual en la esquina superior derecha y abre
esa misma ventana al pulsarla. Ayuda y soporte conserva al final un historial
desplegable desde `1.0.0`, alimentado por `src/lib/novedades.js`; al publicar una
versión nueva se debe actualizar ese archivo y `package.json` en el mismo cambio.

El Plan Básico muestra un aviso preventivo únicamente en Inicio y Pedidos cuando
quedan entre uno y cinco pedidos. Al llegar a cero conserva el aviso de límite
alcanzado y bloquea solo la creación de un pedido nuevo; la consulta y edición
permitida de la información existente no deben bloquearse.

La migración local `20260715190000_notificaciones_soporte.sql` añade mensajes
internos desde Soporte. El administrador envía el mensaje únicamente mediante
una RPC que valida sus permisos y el comentario de origen. Cada cuenta solo
puede consultar y marcar como leídas sus propias notificaciones mediante RLS y
RPCs con `auth.uid()`. Esta migración también debe aplicarse antes de publicar
la campana de notificaciones.

## Tablas del esquema `public`

Hay 14 tablas con RLS activado:

1. `clientes`
2. `codigos_canjeados`
3. `codigos_promocionales`
4. `comentarios_soporte`
5. `lote_productos`
6. `lotes_compra`
7. `pagos`
8. `pedido_contadores`
9. `pedido_folios_usuario`
10. `pedidos`
11. `pedidos_intentos`
12. `perfiles`
13. `productos_pedido`
14. `suscripciones`

No existen vistas públicas, vistas materializadas ni tipos ENUM personalizados. La validación de valores se realiza principalmente con columnas `text` y restricciones `CHECK`.

No hay buckets de Supabase Storage, políticas de Storage ni tablas publicadas en `supabase_realtime`.

## Tablas principales

### `pedidos`

Tiene 24 columnas. Entre las principales:

- `id`
- `user_id`
- `cliente_id`
- `codigo`
- `estado`
- `fecha_pedido`
- `total_shein`
- `total_cliente`
- `anticipo`
- `restante`
- `ganancia`
- `tracking`
- `notas`
- `creado_en`
- `plataforma`
- `public_token`
- `reembolso`
- `reembolso_monto`
- fechas de: cotizado, confirmado, comprado, recibido, dejado en negocio y entregado

`cliente_id` referencia `clientes` con `ON DELETE SET NULL`.

### `pedidos_intentos`

Columnas:

- `id`
- `user_id`
- `pedido_id`
- `creado_en`
- `origen`

`pedido_id` es `UNIQUE` y referencia `pedidos` con `ON DELETE SET NULL`.

### `perfiles`

Tiene 28 columnas. Incluye:

- `plan_actual`
- `plan_origen`
- `plan_expira_en`
- `limite_pedidos`
- `pedidos_usados`
- `es_admin`
- `cuenta_bloqueada`
- `plataforma_predeterminada`
- tiempos estimados por plataforma
- datos del negocio
- preferencias de fecha
- `estado_suscripcion`
- `periodo_inicia_en`
- `suscripcion_cancelada_en`
- `nota_admin`

Valores confirmados:

- `plan_actual`: `basico`, `premium`, `pro`
- `plan_origen`: `sistema`, `manual`, `codigo`, `pago`, `regalo`
- `estado_suscripcion`: `prueba`, `activa`, `vencida`, `cancelada`, `suspendida`, `gratis`
- `plataforma_predeterminada`: `SHEIN`, `Temu`, `AliExpress`, `Catálogo`, `Otro`

Un perfil nuevo se crea con plan Básico, origen `sistema`, límite de 30 pedidos, sin privilegios de administrador, cuenta no bloqueada y plataforma SHEIN. Al vencer Premium o Pro, la lógica regresa el plan a Básico y el límite a 30.

### `productos_pedido`

Tiene 35 columnas, entre ellas:

- datos descriptivos del producto
- precios y cantidades
- estados de pago, entrega y compra
- `lote_compra_id`
- distribución de cupón, envío, comisión, importación e impuesto
- costos y ganancias reales
- fechas logísticas
- `puntos_asignados`

`pedido_id` referencia `pedidos` con `ON DELETE CASCADE`. `lote_compra_id` usa `ON DELETE SET NULL`.

### `suscripciones`

Tiene 14 columnas:

- `id`
- `user_id`
- `plan`
- `monto`
- `moneda`
- `metodo_pago`
- `estado_pago`
- `fecha_inicio`
- `fecha_fin`
- `origen`
- `notas`
- `creado_por`
- `creado_en`
- `actualizado_en`

Valores confirmados:

- `plan`: `premium`, `pro`
- `estado_pago`: `pendiente`, `pagado`, `cancelado`, `vencido`, `reembolsado`
- `origen`: `manual`, `codigo`, `pago`, `stripe`, `mercado_pago`, `regalo`

## Creación de pedidos

La RPC principal es:

`crear_pedido_completo(uuid,text,text,text,text,jsonb,numeric,date)`

Es `SECURITY DEFINER`. Su versión corregida debe:

1. Leer el perfil del usuario.
2. Obtener `plan_actual`, `es_admin` y `limite_pedidos`.
3. Contar los pedidos reales del usuario.
4. Aplicar el límite únicamente al plan Básico y cuando no sea administrador.
5. Comprobar que el cliente pertenezca al usuario.
6. Validar que existan productos válidos.
7. Calcular total de plataforma, total del cliente, ganancia y restante.
8. Insertar el pedido.
9. Insertar sus productos.
10. Registrar el anticipo cuando corresponda.
11. Sincronizar `perfiles.pedidos_usados`.
12. Evitar registros parciales si ocurre un error.

## Triggers relevantes

En `pedidos` existen:

- `ordely_bloquear_pedido_nuevo` — antes de `INSERT`
- `trigger_bloquear_crear_pedido_si_limite` — antes de `INSERT`
- `ordely_sincronizar_pedidos_usados_trigger` — después de `INSERT`, `UPDATE` o `DELETE`
- `trigger_registrar_intento_pedido_creado` — después de `INSERT`

En `lotes_compra` existe:

- `ordely_validar_creacion_nueva` — antes de `INSERT`

Hay una posible redundancia entre los dos triggers de validación previa de `pedidos`, y entre `perfiles.pedidos_usados` y `pedidos_intentos`. Revisar cuidadosamente antes de eliminar o modificar alguno.

## Seguridad

- RLS está activo en las 14 tablas.
- Las políticas principales aíslan datos por `user_id` y `auth.uid()`.
- `perfiles` y `suscripciones` permiten acceso propio o administrativo según la política.
- Las funciones administrativas son `SECURITY DEFINER` y validan internamente al administrador.
- Los grants actuales de `anon` y `authenticated` son amplios; RLS es la barrera efectiva.
- Existe una oportunidad futura de endurecer permisos `EXECUTE` y grants de `anon`, pero no debe hacerse sin pruebas de registro, acceso público, seguimiento y creación de pedidos.

## Volumen aproximado observado

Datos aproximados al 14-jul-2026, sujetos a cambio:

- 61 pedidos
- 120 productos de pedido
- 73 intentos de pedido
- 51 clientes
- 43 pagos
- 15 lotes de compra
- 99 productos de lote
- 9 perfiles
- 2 suscripciones

## Pruebas mínimas para cambios relacionados con pedidos

- Crear pedido sin anticipo.
- Crear pedido con anticipo.
- Crear pedido con varios productos.
- Confirmar cálculo de total, ganancia y restante.
- Confirmar que el cliente pertenece al usuario.
- Confirmar que no quedan pedidos parciales al provocar un error.
- Confirmar límite para Básico.
- Confirmar ausencia de bloqueo para Premium, Pro y administrador.
- Eliminar un pedido y comprobar sincronización de `pedidos_usados`.
- Ejecutar `npm run build` y `npm run lint` cuando exista.

## Información que nunca debe almacenarse aquí

- Contraseñas
- `service_role`
- JWT Secret
- claves privadas
- tokens personales
- archivos `.env`
- datos personales reales de clientes
