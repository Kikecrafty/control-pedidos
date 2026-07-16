# Pruebas manuales de Ordely 1.1.0

Esta lista sirve para revisar la versión local antes de publicarla. Usa únicamente cuentas y pedidos de prueba.

Dirección local: http://127.0.0.1:3000/

## 1. Inicio de sesión y bienvenida

- [] Inicia sesión y confirma que abre el panel sin errores.
- [ ] En una cuenta nueva, completa la ventana **¿Qué es Ordely?**.
- [ ] Cierra sesión y vuelve a entrar con la misma cuenta: la bienvenida no debe aparecer otra vez.
- [ ] Entra con otra cuenta que aún no la haya completado: debe mostrarse de forma independiente.

## 2. Navegación y plan

- [ ] Recorre Inicio, Pedidos, Compras, Clientes, Estadísticas, Referidos, Configuración, Ayuda y Admin.
- [ ] La tarjeta del plan debe permanecer al final del menú y no debe tapar opciones.
- [ ] El menú no debe mostrar una barra horizontal.
- [ ] En Plan Básico, Premium y Pro, la tarjeta debe conservar el mismo ancho y alineación.

## 3. Cliente, pedido, anticipo y totales

- [ ] Crea un cliente de prueba.
- [ ] Crea un pedido con dos productos, cantidades distintas, talla y color.
- [ ] Registra un anticipo parcial.
- [ ] Comprueba que `Restante = Total al cliente - Pagado`.
- [ ] Comprueba que los precios de plataforma y al cliente sean los capturados.
- [ ] Confirma que el pedido recibe un folio consecutivo y no repite otro folio.
- [ ] Edita el cliente y confirma que el pedido conserva sus productos y pagos.

## 4. Compras agrupadas y llegadas

- [ ] Abre Compras y confirma que aparece primero la plataforma predeterminada de Configuración.
- [ ] Cambia la plataforma desde la flecha y confirma que se actualizan los productos pendientes.
- [ ] Usa **Seleccionar todo** y registra una compra con cupón, envío u otros ajustes.
- [ ] Activa **Asignar el costo de cada producto manualmente**, pulsa **Revisar resumen** y captura ahí un costo diferente para cada artículo seleccionado.
- [ ] Si el carrito también contiene artículos personales, confirma que no se incluyan en el total de los pedidos.
- [ ] Comprueba que el costo manual, el ahorro, los cargos y el total calculado coincidan antes de confirmar.
- [ ] Confirma que los productos muestran talla y color correctamente.
- [ ] Desde Inicio, abre una llegada y marca un producto como recibido.
- [ ] Comprueba que los estados y la barra indiquen correctamente: pendiente, posiblemente llegó, recibido por ti y entregado.

## 5. Referidos

> Esta sección requiere aplicar primero las migraciones pendientes a la base que use la aplicación.

- [ ] Una cuenta sin acceso debe ver recompensas, explicación y el botón **Solicitar acceso**.
- [ ] Admin debe poder aprobar o rechazar la solicitud.
- [ ] La cuenta aprobada debe recibir un código `ORD-` propio y un enlace para compartir.
- [ ] Al registrar una cuenta con un código inexistente, el formulario debe detenerse antes de crearla.
- [ ] Al registrar una cuenta con un código activo, debe quedar vinculada al promotor.
- [ ] Solamente la primera mensualidad Premium o Pro pagada debe iniciar la validación de 30 días.
- [ ] Del referido 1 al 9, cada compra válida debe generar 15 días Premium.
- [ ] Desde el referido 10, debe generar 30 días Premium; desde el 20, además, la comisión correspondiente.
- [ ] Un reembolso debe cancelar recompensas pendientes y recalcular o cancelar el retiro relacionado.
- [ ] Una recompensa reembolsada no debe poder canjearse.

## 6. Admin

- [ ] Revisa Resumen, Usuarios, Pagos, Suscripciones, Códigos, Alertas, Soporte y Referidos.
- [ ] En Soporte, abre un cambio sugerido con un mensaje largo: debe verse completo y permitir desplazarse hasta las acciones.
- [ ] Abre dos comentarios seguidos y confirma que cada uno muestre solamente sus propias respuestas.
- [ ] Agrega días a una cuenta con vigencia futura: los días deben sumarse al vencimiento existente, no reiniciarlo desde hoy.
- [ ] Registra un pago de prueba y confirma monto, comisión, neto, estado y fecha.
- [ ] Reembolsa el pago de prueba y confirma que el resumen lo descuenta correctamente.
- [ ] Una cuenta normal no debe poder entrar ni ejecutar acciones administrativas.

## 7. Teléfono

Prueba con un ancho aproximado de 390 px.

- [ ] El menú móvil abre y cierra sin cubrir permanentemente la página.
- [ ] No aparece desplazamiento horizontal.
- [ ] La tarjeta del plan queda al final del menú.
- [ ] Inicio, detalle del pedido, Compras, Planes y Referidos mantienen textos legibles.
- [ ] La progresión de referidos se presenta verticalmente y sus estados se entienden.
- [ ] Los botones pueden pulsarse sin quedar cortados o encimados.

## Resultado

Si algo falla, anota el número de sección, el paso y adjunta una captura. No publiques la versión hasta completar todos los pasos aplicables.
