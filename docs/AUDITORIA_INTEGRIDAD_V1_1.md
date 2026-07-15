# Auditoría de integridad de Ordely v1.0.1

Fecha: 14 de julio de 2026.

## Alcance

La revisión cubrió el frontend, el esquema público de Supabase, RLS, funciones
`SECURITY DEFINER`, pedidos, productos, pagos, anticipos, clientes, compras,
folios, planes, estadísticas, fechas y el despliegue público existente.

El archivo `docs/supabase-schema.sql` se conserva sin cambios como referencia
del esquema de la versión 1.0.0.

## Correcciones locales preparadas

- Creación atómica de pedido, productos y anticipo, incluyendo método y fecha.
- Folios secuenciales y seguros ante concurrencia para todas las plataformas.
- Pagos positivos, sin sobrepasar el saldo, y recalculo automático de totales.
- Entrega de pedido y entrega por producto dentro de una sola transacción.
- Reembolsos limitados al monto realmente pagado.
- Validación de pertenencia entre cliente, pedido, producto, pago y lote.
- RLS reforzado para comprobar también la propiedad de los registros padre.
- Historial financiero de productos comprados protegido contra cambios o borrado.
- Compras atómicas, sin reutilizar productos y con reparto exacto de centavos.
- Límite Básico contado por periodo y aplicado solo a pedidos nuevos.
- Edición de registros existentes permitida al alcanzar el límite Básico.
- Plataformas nuevas aceptadas por perfil, tiempos estimados y folios.
- Estadísticas sin desplazamiento UTC de fechas y con respaldo por cada lote.
- Ganancia del periodo calculada con extras asignados a los mismos pedidos.
- Pedidos entregados excluidos de la cifra de pedidos activos.
- Inicio de sesión y recuperación sin exponer si un correo está registrado.
- Cachés locales de datos eliminados al cerrar sesión.
- Encabezados de seguridad preparados para Cloudflare Pages en `public/_headers`.

## Reparación de datos históricos preparada

La segunda migración completa de forma determinista:

- productos de pedidos ya marcados como entregados;
- productos con booleano de entrega pero estado logístico antiguo;
- columnas agregadas después en lotes antiguos;
- totales de pedidos calculados desde productos y pagos;
- contador de uso del plan para el periodo vigente.

No corrige automáticamente los sobrepagos: se observaron 2 pedidos con un
sobrepago agregado de MXN 296.00. Es necesario decidir comercialmente si se
devuelve el excedente o si el total del pedido debe corregirse.

## Validación realizada

- `npm test`: 9 pruebas correctas.
- `npm run lint`: correcto.
- `npm run build`: correcto.
- Esquema 1.0.0 + ambas migraciones: ejecución correcta desde cero en PostgreSQL
  17.6 local.
- Suite SQL con rol `authenticated`: correcta y revertida con `ROLLBACK`.

La suite SQL verifica RLS, relación entre cuentas, folios, totales, anticipos,
descuentos, costos extra, sobrepagos, historial de compras, entregas completas,
entregas por producto y límite del plan Básico.

## Pasos que requieren autorización posterior

1. Revisar las dos migraciones en `supabase/migrations`.
2. Resolver manualmente los 2 sobrepagos identificados.
3. Aplicar primero la migración de integridad y después la reparación de datos.
4. Probar los flujos principales en un entorno de prueba conectado a Supabase.
5. Publicar el frontend y los encabezados solo después de aprobar el resultado.

No se aplicaron cambios en Supabase, GitHub ni Cloudflare durante este trabajo.
