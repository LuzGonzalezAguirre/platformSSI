# Módulo de Perfil

## Propósito

El módulo de Perfil permite al usuario autenticado consultar y modificar información personal y preferencias de su propia cuenta.

La ruta activa es:

`/profile`

El frontend principal se encuentra en:

`apps/frontend/src/modules/profile/ProfilePage.tsx`

El backend pertenece a `apps.identity` y reutiliza el modelo de usuario, serializers y servicios de identidad.

## Estado

Estado actual: implementado con elementos de interfaz que representan capacidades todavía no respaldadas por backend.

El flujo funcional soporta:

- consulta de datos del usuario desde el estado autenticado;
- edición de nombre y apellido;
- edición de email;
- cambio de idioma preferido;
- cambio de theme preferido;
- cambio de timezone;
- carga o reemplazo de avatar;
- cambio de contraseña;
- visualización de roles, planta y último acceso.

La sección visual de sesiones activas no representa actualmente un sistema real de administración de sesiones.

## Ruta y acceso

`App.tsx` registra:

`/profile`

La ruta está dentro de `PrivateRoute`.

Por tanto, requiere una sesión autenticada, pero no un permiso de módulo específico.

Esto es consistente con la naturaleza de autoservicio del perfil: el usuario opera únicamente sobre `request.user`.

## Backend

Endpoints:

| Método | Endpoint | Uso |
| --- | --- | --- |
| GET | `/api/v1/auth/me/` | Obtener usuario autenticado |
| PATCH | `/api/v1/auth/me/update/` | Actualizar perfil |
| POST | `/api/v1/auth/me/change-password/` | Cambiar contraseña |
| POST | `/api/v1/auth/me/avatar/` | Cargar o reemplazar avatar |

Todos estos flujos trabajan sobre el usuario autenticado.

## Datos editables

`ProfileUpdateSerializer` permite modificar:

- `first_name`;
- `last_name`;
- `email`;
- `preferred_language`;
- `preferred_theme`;
- `timezone`.

No permite editar desde este flujo:

- `employee_id`;
- password directamente;
- roles;
- estado activo;
- superuser.

`ProfileService.update_profile` mantiene una lista adicional de campos protegidos para evitar que entren por actualización genérica.

## Email requerido por rol

`ProfileUpdateSerializer` define:

`ROLES_REQUIRING_EMAIL = {"supervisor", "ingeniero", "admin", "gerente"}`

Al guardar, obtiene los slugs reales de `instance.roles`.

Si el usuario tiene al menos uno de esos slugs y el email queda vacío, la actualización se rechaza.

Debe observarse que esta lista utiliza nombres de rol específicos y no necesariamente coincide con toda la taxonomía backend documentada en Permissions.

## Cambio de contraseña

El modal envía:

- `current_password`;
- `new_password`;
- `confirm_password`.

El serializer valida:

1. nueva contraseña y confirmación deben coincidir;
2. la nueva contraseña debe tener al menos ocho caracteres;
3. la nueva contraseña debe ser diferente a la actual.

`ProfileService.change_password` valida además que `current_password` sea correcto usando `user.check_password`.

Si la contraseña actual no coincide, responde error 400.

La actualización final utiliza `UserRepository.reset_password`.

## Avatar

El endpoint usa:

- `MultiPartParser`;
- `FormParser`.

El campo multipart esperado es:

`avatar`

Formatos permitidos:

- JPEG;
- PNG;
- WEBP.

Tamaño máximo:

2 MB.

Si el usuario ya tiene un avatar, el archivo anterior se elimina antes de guardar el nuevo.

Después de guardar, el backend devuelve el `UserSerializer` actualizado.

## Estado frontend

`ProfilePage` obtiene el usuario desde `useAuthStore`.

El formulario local se inicializa con:

- first name;
- last name;
- email;
- preferred language;
- preferred theme;
- timezone.

Existe un snapshot `savedForm` utilizado para restaurar los valores al cancelar.

El avatar mantiene por separado:

- avatar actual;
- preview;
- archivo pendiente.

## Flujo de guardado

`handleSave()` realiza el siguiente flujo:

1. PATCH de `/auth/me/update/`;
2. reemplaza el usuario del auth store con la respuesta;
3. si existe un nuevo avatar, lo sube mediante `UsersService.uploadAvatar`;
4. vuelve a actualizar el auth store con la respuesta del avatar;
5. aplica el theme seleccionado;
6. actualiza el snapshot local;
7. sale del modo edición.

La actualización del auth store se realiza mediante `setAuth`, reutilizando access token y refresh token existentes.

## Persistencia en localStorage

`setAuth` persiste:

- `mes_access_token`;
- `mes_refresh_token`;
- `mes_user`;
- `mes_language`.

También cambia activamente el idioma de i18n usando `user.preferred_language`.

Por ello, guardar un nuevo idioma desde Profile actualiza tanto el backend como el idioma activo del frontend después de recibir la respuesta.

## Theme

`ProfilePage` reutiliza `useTheme`.

Valores soportados:

- `light`;
- `dark`;
- `system`.

Después de guardar el perfil se llama:

`setTheme(form.preferred_theme)`

`useTheme` persiste la selección en:

`mes_theme`

y aplica el theme resuelto mediante el atributo:

`data-theme`

sobre el elemento HTML.

Cuando el valor es `system`, escucha cambios de `prefers-color-scheme`.

## Doble persistencia de theme

La preferencia de theme existe en dos ubicaciones:

1. backend, campo `preferred_theme` del usuario;
2. localStorage, key `mes_theme`.

El guardado desde Profile actualiza ambas.

Sin embargo, `useTheme` inicializa su estado desde `mes_theme`, no directamente desde `user.preferred_theme`.

Por tanto, la consistencia entre preferencia almacenada en backend y preferencia local depende de los flujos que mantengan sincronizadas ambas fuentes.

## Idioma

La preferencia también existe tanto en backend como en localStorage.

`setAuth` actualiza `mes_language` e i18n.

Esto hace que el flujo de Profile sí sincronice la preferencia backend con la sesión local después de guardar.

## Timezone

El frontend ofrece un catálogo hardcodeado:

- America/Tijuana;
- America/Mexico_City;
- America/Monterrey;
- America/Chicago;
- America/New_York;
- America/Los_Angeles;
- America/Detroit;
- UTC.

El backend acepta el valor del serializer/modelo sin que este componente consulte un catálogo central.

El timezone predeterminado mostrado por Profile es `America/Tijuana` cuando el usuario no tiene valor en el estado local.

La configuración global Django está documentada por separado y puede ser diferente del timezone individual del usuario.

## Información de cuenta

La vista muestra:

- roles;
- planta;
- employee ID;
- estado visual de cuenta;
- último acceso.

`employee_id` se presenta como read-only.

Los roles también son informativos en Profile; su edición corresponde al flujo administrativo.

## Último acceso

`formatLastLogin` recibe `last_login_at`.

Presenta:

- "just now" para menos de dos minutos;
- minutos para menos de una hora;
- horas para menos de un día;
- "yesterday" para un día;
- fecha local para valores anteriores.

Parte de estas cadenas utiliza i18n y parte se construye directamente con sufijos `m ago` y `h ago`.

Por tanto, la localización del texto relativo no es completamente uniforme.

## Sesiones activas

La sección Security muestra:

- `1 active`;
- dispositivo actual;
- badge `current`.

No existe en el código revisado una consulta a backend para sesiones activas.

No existe en Profile un endpoint para:

- listar sesiones;
- identificar dispositivos;
- revocar sesiones;
- cerrar otras sesiones.

La UI representa únicamente la sesión actual de forma estática.

No debe documentarse como una función real de administración de sesiones.

## Permisos

`ProfilePage` prepara:

- `userPermissions`;
- `permissionModules`;
- `MODULE_ICONS`;
- componentes y estilos asociados a permisos.

Sin embargo, en el JSX revisado no se renderiza una lista de permisos después de la sección System Info.

Por tanto, aunque el usuario recibido desde backend incluye `permissions`, Profile no los muestra actualmente en pantalla.

Debe distinguirse esta infraestructura preparada de una función visible.

## UserSerializer

La respuesta de usuario contiene:

- identidad;
- job title;
- roles;
- plant;
- preferencias;
- timezone;
- last login;
- avatar URL;
- permisos efectivos.

### avatar_url

Cuando existe request en el serializer, la URL se construye como URL absoluta.

En otro caso se devuelve la ruta del archivo.

### roles

Se devuelven como lista con:

- id;
- name;
- slug.

### permissions

Se calculan mediante `PermissionService.get_user_permissions`.

## requires_email

`UserSerializer.get_requires_email` devuelve:

`bool(obj.email)`

Esto significa que el campo indica actualmente si el usuario tiene un email cargado.

No indica si, según su rol, el email es obligatorio.

El nombre `requires_email` no coincide con su semántica real.

La regla real de obligatoriedad por rol vive en `ProfileUpdateSerializer.ROLES_REQUIRING_EMAIL`.

## Seguridad

Los endpoints de Profile utilizan `IsAuthenticated`.

No aceptan un user ID de destino para modificar otra cuenta.

La identidad modificada se obtiene de `request.user`.

Esto reduce el riesgo de acceso horizontal en el flujo de autoservicio.

El avatar valida tipo MIME y tamaño antes de almacenarse.

## Manejo de errores

Profile intenta convertir objetos de error del backend en texto por campo.

Ejemplo lógico:

`campo: primer mensaje`

El mismo patrón se utiliza en:

- actualización de perfil;
- cambio de contraseña.

Los errores no se almacenan globalmente.

## Datos y archivos

Los datos de perfil pertenecen al modelo `identity.User`.

Los avatares utilizan el storage configurado para `MEDIA_ROOT` y `MEDIA_URL`.

No existe un storage separado específico de Profile.

## Limitaciones actuales

### Sesiones activas simuladas en UI

La pantalla muestra una sesión activa sin obtener datos reales de sesión.

### Permisos preparados pero no renderizados

Existe código para procesar permisos, pero no una sección visible que los presente.

### requires_email con nombre incorrecto

El serializer devuelve presencia de email, no obligatoriedad por rol.

### Catálogo de timezone hardcodeado

No existe una única autoridad compartida para valores permitidos.

### Theme con dos fuentes de persistencia

Backend y localStorage almacenan la preferencia.

### Localización parcial de último acceso

Algunos textos relativos permanecen construidos en inglés.

### Avatar sin eliminación explícita

El flujo permite reemplazar el avatar, pero no existe un endpoint o control visible para dejar al usuario sin avatar eliminándolo voluntariamente.

## Pruebas prioritarias

Escenarios recomendados:

1. actualización de campos permitidos;
2. intento de modificar campos protegidos;
3. rol que exige email;
4. contraseña actual incorrecta;
5. nueva contraseña igual a la actual;
6. confirmación diferente;
7. avatar válido;
8. tipo MIME no permitido;
9. avatar mayor a 2 MB;
10. eliminación del archivo anterior al reemplazar avatar;
11. sincronización de idioma;
12. sincronización de theme backend/localStorage;
13. timezone;
14. comportamiento de permisos si se habilita su render;
15. administración real de sesiones si se implementa.

## Regla de mantenimiento

Profile debe continuar operando únicamente sobre el usuario autenticado.

La administración de otros usuarios pertenece al módulo Administration.

Si se implementa administración real de sesiones, debe crearse un contrato backend explícito antes de presentar conteos o dispositivos como datos reales.
