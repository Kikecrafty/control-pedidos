# Ordely — instrucciones para Codex

## Alcance
- Proyecto: Ordely / MiOrdely.
- Versión de trabajo actual: `1.0.0`.
- Antes de cambiar código, lee `docs/ORDELY_CONTEXT.md` y revisa el repositorio.
- No asumas que una función, tabla o columna existe: verifícala en el código o en las migraciones/SQL disponibles.

## Reglas obligatorias
- No exponer ni escribir en commits: `service_role`, JWT secrets, contraseñas, tokens, claves privadas, archivos `.env` ni datos personales de clientes.
- No ejecutar SQL destructivo (`DROP`, `TRUNCATE`, `DELETE` masivo o cambios irreversibles) sin autorización explícita.
- Toda modificación de Supabase debe entregarse como archivo SQL revisable y, cuando sea posible, idempotente.
- Mantener RLS activo y respetar el aislamiento por `auth.uid()`.
- No debilitar políticas RLS ni permisos para “hacer que funcione”.
- Evitar cambios grandes no relacionados con la tarea.
- No cambiar la versión del producto salvo instrucción explícita.

## Flujo de trabajo
1. Inspeccionar los archivos relevantes y explicar brevemente la causa del problema.
2. Proponer el cambio mínimo.
3. Implementar el cambio.
4. Ejecutar las comprobaciones disponibles, como mínimo:
   - `npm run build`
   - `npm run lint` si existe en `package.json`
5. Revisar `git diff` y señalar cualquier riesgo o paso manual en Supabase.
6. No hacer `git push`, publicar ni ejecutar migraciones remotas sin autorización explícita.

## Lógica que no debe romperse
- Planes válidos: `basico`, `premium`, `pro`.
- El plan Básico usa un límite de pedidos; Premium, Pro y administradores no deben bloquearse por ese límite.
- `perfiles.pedidos_usados` debe mantenerse sincronizado con la lógica real de pedidos.
- La creación de pedidos debe ser atómica: pedido, productos y anticipo no deben dejar registros parciales si algo falla.
- El cliente seleccionado debe pertenecer al usuario autenticado.
- Las funciones administrativas deben validar internamente que el usuario sea administrador.

## Comunicación
- Responder en español.
- Indicar exactamente qué archivos se modificaron.
- Separar los cambios de código de los pasos manuales de Supabase.
