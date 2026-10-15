# Escala compartida del plano de almacén

El diseñador de almacén y la vista de Storage Utilization usan ahora un mismo sistema de coordenadas: 1200 × 650 px, con posiciones y dimensiones de las localidades expresadas en porcentaje.

Las dos pantallas renderizan los racks mediante `rackStyle` en `storage.shared.ts`, sin `minWidth` ni `minHeight` que amplíen visualmente un rack más allá del tamaño configurado. Ambos contenedores tienen desplazamiento horizontal en pantallas más estrechas: el plano no se reduce, preservando escala, posiciones y separaciones. No se modifican datos almacenados ni el API.

El cambio corrige superposiciones debidas a diferencias de escala y dimensiones mínimas. No detecta ni resuelve solapamientos de coordenadas que existan en los propios datos: si dos racks tienen rectángulos superpuestos o se rotan alrededor de su centro, todavía pueden solaparse y deben ajustarse desde el diseñador.

Pruebas pendientes en ambiente del usuario: validar el layout con racks lado a lado, con niveles distintos y en vista normal y expandida; confirmar Build de TypeScript.
