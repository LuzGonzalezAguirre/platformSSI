# Registro de deuda técnica

## Propósito

Este documento consolida hallazgos detectados durante la documentación AS-IS.

No significa que todos deban corregirse en el mismo cambio.

La prioridad considera impacto potencial sobre seguridad, disponibilidad, mantenibilidad y consistencia de datos.

## Prioridad crítica

### Secretos versionados

Se observaron credenciales y tokens funcionales definidos como valores en archivos versionados.

Áreas afectadas:

- Docker Compose;
- settings;
- Q-Wall Proxy;
- scan rules proxy.

Acción requerida:

- rotar secretos existentes;
- retirar valores del repositorio;
- usar variables de entorno o secret store;
- evitar defaults válidos;
- incorporar secret scanning en CI.

### Autorización administrativa backend

El modelo RBAC existe, pero endpoints administrativos de usuarios, roles y permisos utilizan en varios casos únicamente `IsAuthenticated`.

Ocultar esas pantallas en frontend no protege la API.

Acción requerida:

- definir permisos backend por endpoint;
- cubrirlos con tests negativos y positivos;
- verificar superuser y roles de sistema.

## Prioridad alta

### Downtime assignment write sin RBAC específico

El PUT de asignaciones de Downtime está marcado en el código como pendiente de endurecimiento y utiliza únicamente autenticación.

Debe limitarse a los roles definidos por negocio.

### Tracebacks y detalles internos desde Q-Wall Proxy

Algunos handlers devuelven el traceback completo dentro del detalle HTTP.

Esto puede revelar SQL e infraestructura.

Los detalles deben quedar en log interno y la respuesta debe ser controlada.

### Runtime de desarrollo

Django usa `runserver` y frontend usa Vite dev server.

Para producción debe existir un runtime explícito y endurecido.

### Scripts de arranque ambiguos

Los `.bat` versionados contienen sintaxis de PowerShell que parece generar archivos Batch.

Debe definirse un único formato ejecutable y probarse desde cero en un host limpio.

### Backup y restore no documentados/automatizados

El repositorio no contiene un procedimiento reproducible para PostgreSQL, media ni dependencias CCS.

Antes de considerar recuperación operativa, backup y restore deben probarse.

### Observabilidad insuficiente

No existe infraestructura de métricas, trazas o alertas centralizadas.

Los fallos de proxies, Celery y jobs semanales deberían ser detectables sin revisar manualmente consolas.

## Prioridad media

### Sidebar con rol admin hardcodeado

`AppShell` pasa `admin` al Sidebar independientemente del usuario.

Debe usarse el modelo real de permisos/roles.

### Taxonomías de roles duplicadas

Frontend y backend mantienen nombres y categorías de roles diferentes.

Debe existir una sola autoridad.

### Guards de rutas frontend

`PrivateRoute` valida únicamente autenticación.

Conviene añadir guards por permiso para UX, manteniendo backend como autoridad de seguridad.

### API URL frontend hardcodeada

El cliente compartido define localhost en código aunque Compose suministra una variable Vite.

Debe leerse configuración de ambiente.

### Refresh token sin renovación automática

Se almacena refresh token, pero el interceptor no intenta renovar access token.

Definir una política única de sesión.

### Implementaciones duplicadas de Attendance / Chairs

Los paquetes SSI paralelos no están conectados y además contienen referencias faltantes.

La función activa vive bajo Production.

Debe elegirse una implementación canónica.

### Métodos duplicados en Production

Se detectaron definiciones repetidas de:

- `CcsAttendanceDailyView`;
- `AttendancePolicy.resolve_hours`;
- `OpsDailyPDFExportView.get`.

Python utiliza la última definición, pero esto genera ambigüedad y riesgo de modificar una versión inactiva.

### Método Q-Wall Repository duplicado

`get_part_numbers` aparece dos veces.

Debe mantenerse una sola implementación.

### Semántica de include_test

En Q-Wall, `include_test=true` selecciona únicamente pruebas.

El nombre sugiere que las incluiría junto con producción.

Renombrar o cambiar contrato explícitamente.

### Contrato CTB incompleto

El frontend espera metadata de revisión activa que el serializer backend no declara.

Alinear DTO backend/frontend.

### Rechazo Problem Control: comentario versus código

El comentario de aprobación final sugiere conservar aprobaciones previas, pero el código de rechazo las limpia.

La regla de negocio debe decidirse y reflejarse igual en código, tests y documentación.

### Contrato parcial del chatbot Q-Wall

El chatbot declara capacidades configurables que no están completas de extremo a extremo.

Hallazgos:

- `ChatbotQuestionTemplate.required_filters` no es la fuente utilizada por el runtime; el servicio consulta `intent.required_filters`;
- `media_list` existe en modelos y DTO, pero el widget no renderiza `media`;
- el fixture versionado contiene texto español con problemas de encoding y una referencia fija de `created_by`.

Antes de ampliar el chatbot conviene alinear el contrato, agregar tests y reemplazar el fixture por un mecanismo portable de seed.

### Action Tracker URL hardcodeada en proxy

Existe configuración para Action Tracker, pero el endpoint de referencias construye links con un host fijo.

Usar configuración.

### Main Q-Wall Proxy monolítico

El archivo principal agrupa Q-Wall, attendance, chairs, settings, outboxes, Action Tracker y lot sampling.

Dividir por routers/repositories.

### SQL inline en proxy

Mover queries complejas a repositories facilita pruebas y manejo de conexión.

### Restricción por Business Unit no implementada

`get_allowed_bu_for_user` devuelve todas las BUs para todos los usuarios.

La infraestructura para centralizar el filtro existe, pero la política real está pendiente.

## Prioridad baja o limpieza

### Duplicate maintenance URL include

El prefijo Maintenance aparece dos veces en `config/urls.py`.

Eliminar duplicado para evitar confusión.

### requirements.txt raíz del backend

El archivo no representa la definición completa de dependencias y contiene entradas redundantes.

Definir una única convención de requirements.

### Archivos históricos Quality

Existen backups y archivos old dentro del paquete activo.

Moverlos fuera del runtime o eliminarlos una vez confirmado que no se necesitan.

### Árbol backend dentro del frontend

Existe scaffolding vacío de backend bajo `apps/frontend/src/apps/backend`.

Eliminarlo si no tiene propósito.

### Componentes Maintenance vacíos

Se observaron archivos de componentes sin implementación dentro de Work Requests.

Eliminar o implementar para evitar falsas señales de funcionalidad.

### Nombre de archivo Problem List

`ProlemListPage.tsx` contiene un typo.

No afecta el runtime mientras imports coincidan, pero reduce claridad.

## Mejoras de ingeniería recomendadas

Después de atender seguridad, los siguientes bloques aportarían mayor estabilidad:

1. suite de tests de contratos proxy;
2. CI con build y tests;
3. secret scanning;
4. healthchecks de servicios;
5. structured logging;
6. métricas de Celery y proxies;
7. documentación OpenAPI consolidada;
8. configuración por ambiente;
9. tests de autorización por endpoint;
10. limpieza de código inactivo.

## Regla de seguimiento

Cuando una deuda se corrija:

- el mismo PR debe actualizar este documento;
- debe eliminarse o marcarse como resuelta;
- si cambia arquitectura o contrato, actualizar además el documento del módulo correspondiente.
