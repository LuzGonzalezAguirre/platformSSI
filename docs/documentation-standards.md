# Estándar de documentación

## Propósito

La documentación de platformSSI debe describir el sistema real y servir como referencia de mantenimiento. No debe funcionar como texto promocional ni como una guía genérica de tecnologías.

## Fuente de verdad

La documentación se valida contra código fuente, configuración, migraciones, modelos, rutas, servicios, tareas y scripts existentes.

Cuando no exista evidencia suficiente para afirmar que una función está implementada, el documento debe indicarla como parcial, pendiente o estructura reservada.

## Contenido mínimo por módulo

| Sección | Contenido esperado |
| --- | --- |
| Propósito | Problema operativo que resuelve |
| Alcance | Responsabilidades incluidas y excluidas |
| Entradas | Parámetros, eventos o fuentes de datos |
| Salidas | API, vistas, archivos, acciones o registros producidos |
| Backend | URLs, vistas, serializers, servicios, repositorios y tareas |
| Frontend | Rutas, páginas, componentes y servicios |
| Datos | Modelos Django, tablas externas y ownership |
| Integraciones | Servicios externos, proxies y contratos |
| Reglas de negocio | Decisiones implementadas en código |
| Seguridad | Autenticación, permisos y restricciones |
| Operación | Dependencias, jobs y consideraciones de despliegue |
| Limitaciones | Deuda técnica, comportamiento parcial y riesgos conocidos |
| Pruebas | Cobertura existente y escenarios importantes |

## Convenciones

Los nombres de clases, funciones, rutas, tablas y variables deben escribirse exactamente como aparecen en el código.

Los secretos, contraseñas, tokens y cadenas de conexión sensibles no deben copiarse a la documentación.

Las reglas de negocio deben explicar el comportamiento, no duplicar bloques extensos de código.

Los ejemplos deben utilizar datos ficticios cuando no sea necesario mostrar datos reales.

Las secciones históricas deben diferenciar claramente decisiones vigentes de implementaciones anteriores.

## Estado de un módulo

`Implementado` indica que existe un flujo funcional identificable en código.

`Parcial` indica que existe implementación, pero el flujo está incompleto, contiene placeholders o depende de componentes pendientes.

`Estructura` indica que existe organización de carpetas o archivos sin una implementación funcional suficiente.

`Pendiente de validación` indica que el código existe pero todavía no se ha revisado con suficiente profundidad para asignar una clasificación definitiva.

## Cambios documentales

La documentación debe actualizarse en el mismo pull request cuando un cambio afecte contratos de API, modelos de datos, rutas, tareas programadas, integraciones, configuración de despliegue o reglas de negocio.

Los cambios puramente visuales pueden limitarse a documentación de frontend cuando no alteren comportamiento.

## Seguridad documental

La documentación puede registrar que una credencial existe, dónde se espera y qué componente la utiliza. No debe almacenar su valor.

Cuando se detecte un secreto versionado, la documentación debe marcar el riesgo sin replicar el secreto.
