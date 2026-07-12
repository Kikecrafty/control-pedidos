ORDELY V39 - OFERTA GRATUITA EN DATOS ESTRUCTURADOS

1. Copia el archivo index.html sobre la raíz de tu proyecto.
2. Ejecuta:

npm run build
git status
git add .
git commit -m "Agregar oferta gratuita a datos estructurados"
git push -u origin HEAD

CAMBIO PRINCIPAL
- Agrega offers al marcado WebApplication:
  - Precio: 0
  - Moneda: MXN
  - Descripción: Plan gratuito disponible

NO SE AGREGA aggregateRating porque solo debe utilizarse cuando existan calificaciones reales y visibles.

DESPUÉS DEL DESPLIEGUE
- Repite la Prueba de resultados enriquecidos en https://miordely.com/
- Debe desaparecer la advertencia de offers.
- La advertencia de aggregateRating puede permanecer como opcional.
