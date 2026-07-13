# Estilos de Ordely

Esta carpeta fue creada en la V61 para separar el antiguo `index.css` sin cambiar la apariencia.

## Regla importante

Los archivos se importan en orden numérico porque las versiones más recientes contienen correcciones que deben cargarse después de las reglas anteriores. No cambies el orden de los `@import` de `src/index.css` sin revisar visualmente toda la aplicación.

## Organización

- `01-base-y-componentes.css`: base, layout, formularios, tablas, badges, modales y responsive inicial.
- `02-publico-y-acceso.css`: landing pública, login, marca y recuperación de contraseña.
- `03-pedidos-productos-estados.css`: productos múltiples, pagos, reembolsos y paginación.
- `04-navegacion-planes-cuenta-legacy.css`: navegación, cuenta y planes anteriores que todavía participan en la cascada.
- `05-compras.css`: compras agrupadas, descuentos, historial y pasos.
- `06-dashboard-y-pedidos.css`: dashboard y evolución visual de la lista de pedidos.
- `07-detalle-fechas-y-contacto.css`: detalle del pedido, fechas y medios de contacto.
- `08-compras-metricas-y-pulido.css`: compras recientes, métricas y estabilización responsiva.
- `09-flujo-v55.css`: navegación y flujo simplificado.
- `10-detalle-v56.css`: detalle de pedido por secciones.
- `11-clientes-v57.css`: ficha e historial de clientes.
- `12-estadisticas-v58.css`: estadísticas claras.
- `13-cuenta-v59.css`: configuración de cuenta y correcciones de tiempos de llegada.
- `14-navegacion-movil-v59.css`: estado activo de la navegación móvil.
- `15-mensajes-v60.css`: estados vacíos, toast y confirmaciones.

Esta separación es una limpieza segura. Una eliminación profunda de reglas antiguas deberá hacerse pantalla por pantalla, con comparación visual, para no alterar el diseño aprobado.
