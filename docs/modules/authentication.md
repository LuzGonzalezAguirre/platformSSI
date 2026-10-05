# Módulo de Autenticación

## Propósito

El módulo de Autenticación controla el inicio y cierre de sesión, emisión y renovación de tokens JWT, carga del usuario autenticado y persistencia local del estado de sesión en el frontend.

El frontend se encuentra principalmente en:

- `apps/frontend/src/modules/auth/LoginPage.tsx`;
- `apps/frontend/src/modules/auth/useAuth.ts`;
- `apps/frontend/src/services/auth.service.ts`;
- `apps/frontend/src/services/api.client.ts`;
- `apps/frontend/src/store/authStore.ts`.

El backend pertenece a `apps.identity`:

- `views/auth_view.py`;
- `services/auth_service.py`;
- `serializers/auth.py`.

## Estado

Estado actual: implementado con deuda en renovación automática de tokens y amplitud del endpoint `/auth/me/`.

La autenticación usa JWT mediante Django REST Framework Simple JWT.

El identificador de login es `employee_id`, no `username`.

## Endpoints

| Método | Endpoint | Uso |
| --- | --- | --- |
| POST | `/api/v1/auth/login/` | Inicio de sesión |
| POST | `/api/v1/auth/logout/` | Cierre de sesión y blacklist del refresh |
| POST | `/api/v1/auth/refresh/` | Obtener un access token nuevo |
| GET | `/api/v1/auth/me/` | Obtener usuario autenticado |
| PATCH | `/api/v1/auth/me/` | Actualización directa mediante `UserSerializer` |

Los endpoints de Profile dedicados se documentan en `profile.md`.

## Login

`LoginPage` solicita:

- employee number;
- password.

El hook `useAuth.login()` llama a:

`AuthService.login(employee_id, password)`

que ejecuta:

`POST /auth/login/`

El backend valida la entrada mediante `LoginSerializer`.

## Autenticación backend

`AuthService.login` usa:

`authenticate(username=employee_id, password=password)`

El modelo User define:

`USERNAME_FIELD = "employee_id"`

Por ello Django interpreta el valor entregado como identificador de autenticación aunque el parámetro de `authenticate` se llame `username`.

Si la autenticación falla, el servicio responde con error de credenciales.

Cuando es correcta:

1. actualiza `last_login_at`;
2. registra un AuditLog LOGIN;
3. genera refresh token;
4. deriva access token;
5. devuelve el usuario.

## Tokens generados

El refresh token incorpora claims adicionales:

- `employee_id`;
- `plant`.

La respuesta de login contiene:

- `access`;
- `refresh`;
- `user`.

El usuario se serializa con `UserSerializer`, que incluye roles, permisos efectivos, preferencias, plant, avatar y último acceso.

## Lifetimes

La configuración de Simple JWT define:

- access token: 60 minutos;
- refresh token: 7 días.

También está configurado:

`ROTATE_REFRESH_TOKENS = True`

Sin embargo, el endpoint de refresh es una implementación custom y no usa el serializer estándar de Simple JWT que aplica rotación automáticamente.

`AuthService.refresh_token` crea un `RefreshToken` desde el token recibido y devuelve únicamente:

`{ "access": ... }`

Por tanto, la rotación configurada no se materializa en este flujo custom.

## Persistencia frontend

`authStore` guarda en localStorage:

- `mes_access_token`;
- `mes_refresh_token`;
- `mes_user`;
- `mes_language`.

`isAuthenticated` se inicializa como verdadero únicamente cuando existen:

- access token;
- usuario almacenado.

La presencia exclusiva de refresh token no mantiene una sesión autenticada.

## setAuth

`setAuth` realiza cuatro acciones:

1. guarda access token;
2. guarda refresh token;
3. guarda el objeto user;
4. guarda el idioma preferido.

Además importa i18n y ejecuta:

`changeLanguage(user.preferred_language)`

Por ello login y los flujos que reutilizan `setAuth` sincronizan activamente idioma de sesión.

## Renovación del usuario

`useAuth` ejecuta, al montarse y cuando ya existe una sesión autenticada:

`AuthService.me()`

Esto refresca desde backend:

- roles;
- permisos;
- preferencias;
- datos de usuario.

La respuesta se guarda mediante `updateUser`.

`updateUser` actualiza `mes_user`, pero no toca tokens.

## Refresh token

Existe:

`POST /auth/refresh/`

pero el frontend revisado no lo consume.

`api.client.ts` no intenta renovar el access token cuando recibe HTTP 401.

Por tanto, aunque exista un refresh token válido, al expirar el access token la sesión no se renueva automáticamente.

## Manejo global de 401

El interceptor de Axios:

1. detecta HTTP 401;
2. elimina únicamente `mes_access_token`;
3. redirige mediante `window.location.href = "/login"`;
4. rechaza la promesa original.

No elimina:

- `mes_refresh_token`;
- `mes_user`;
- `mes_language`.

Tras la recarga, `isAuthenticated` resulta falso porque ya no existe access token, pero quedan datos residuales de la sesión anterior en localStorage.

## Logout

`useAuth.logout()` obtiene `mes_refresh_token` y llama:

`POST /auth/logout/`

El backend:

1. intenta construir el RefreshToken;
2. intenta agregarlo al blacklist;
3. registra LOGOUT;
4. responde éxito.

El bloque de blacklist está envuelto en `try/except`, por lo que un refresh inválido no impide terminar el logout.

En frontend, `clearAuth()` se ejecuta en `finally`.

Esto garantiza limpieza local aunque falle la petición al backend.

`clearAuth` elimina:

- access token;
- refresh token;
- user.

No elimina `mes_language`.

## Blacklist

La aplicación tiene habilitado:

`rest_framework_simplejwt.token_blacklist`

El logout utiliza:

`token.blacklist()`

Por ello el refresh token enviado correctamente puede quedar revocado en backend.

El access token ya emitido no se revoca directamente mediante este mecanismo y conserva validez hasta expirar, salvo otra política externa.

## Cliente HTTP

`apiClient` agrega en cada request:

`Authorization: Bearer {mes_access_token}`

cuando existe token.

También agrega:

`Accept-Language`

usando `mes_language` o español como fallback.

El mismo cliente se usa para login aunque todavía no exista token.

## Base URL

El cliente declara:

`http://localhost:8000/api/v1`

directamente en código.

Aunque la constante se llama `VITE_API_BASE_URL`, no se lee desde `import.meta.env`.

Este problema ya está registrado como deuda transversal de frontend.

## PrivateRoute

`App.tsx` contiene un guard general:

`PrivateRoute`

Su única condición es:

`isAuthenticated`

Si es false, redirige a:

`/login`

No valida:

- vigencia real del token;
- rol;
- permiso de módulo.

La autorización funcional debe continuar en backend.

## Login route

La ruta pública es:

`/login`

Si `isAuthenticated` ya es verdadero, el router redirige al dashboard raíz.

El resto de las rutas entra por `PrivateRoute`.

## GET /auth/me/

`MeView.get` requiere `IsAuthenticated`.

Devuelve `UserSerializer(request.user)`.

Este endpoint es utilizado por `useAuth` para sincronizar el usuario y permisos después de cargar una sesión existente.

## PATCH /auth/me/

`MeView.patch` también utiliza `UserSerializer` directamente como serializer de escritura.

`UserSerializer` solo marca explícitamente como read-only:

- `id`;
- `employee_id`.

Otros campos de modelo incluidos en el serializer pueden quedar disponibles para escritura según el comportamiento de DRF, entre ellos:

- first_name;
- last_name;
- email;
- job_title;
- plant;
- preferred_language;
- preferred_theme;
- timezone;
- is_active.

Los campos calculados por `SerializerMethodField`, como roles y permissions, son read-only.

## Diferencia con Profile

Existe un endpoint más restringido:

`PATCH /auth/me/update/`

que usa `ProfileUpdateSerializer`.

Ese serializer limita el flujo a:

- first_name;
- last_name;
- email;
- preferred_language;
- preferred_theme;
- timezone.

La UI de Profile utiliza este endpoint dedicado, no el PATCH de `/auth/me/`.

Por ello existen dos contratos de actualización del propio usuario con alcances distintos.

Conviene eliminar el PATCH amplio de `MeView` o alinearlo con `ProfileUpdateSerializer`.

## Auditoría

Login y logout registran eventos explícitos mediante `_log_audit`.

Se guardan:

- user;
- action;
- module = identity;
- resource = session;
- IP;
- user agent.

La función de auditoría captura excepciones para evitar que una falla de logging interrumpa autenticación.

## IP

Login y logout leen primero:

`HTTP_X_FORWARDED_FOR`

Si existe, toman el primer valor.

De lo contrario usan:

`REMOTE_ADDR`

Esto asume que el header forwarded es confiable en la topología de despliegue.

La confianza real debe depender de que solo proxies controlados puedan establecer dicho header.

## User agent

Se captura desde:

`HTTP_USER_AGENT`

y se limita a 255 caracteres al registrar auditoría.

## Internacionalización

El LoginPage revisado mantiene sus labels principales directamente en inglés:

- System access;
- Employee Number;
- Password;
- Authenticating;
- Sign in.

El error fallback del hook está en español.

Por tanto, la pantalla de login no utiliza actualmente el sistema i18n de forma consistente.

## Estado de error

`useAuth.login` busca en este orden:

1. `response.data.detail`;
2. primer error de `employee_id`;
3. fallback "Error al iniciar sesión.".

Devuelve boolean:

- true si autentica;
- false si falla.

`LoginPage` no navega explícitamente después del login; el cambio de `isAuthenticated` hace que la estructura de rutas renderice la aplicación autenticada.

## Seguridad y límites

### Credenciales

La contraseña solo se envía al endpoint de login y no se persiste en estado global o localStorage.

### Tokens

Los tokens se almacenan en localStorage.

Esto permite persistencia entre recargas, pero implica que un XSS con ejecución JavaScript en el origen podría leerlos.

No se utilizan cookies HttpOnly en la implementación actual.

### Logout

El refresh se blacklistea cuando es válido.

### Autorización

Autenticación no equivale a autorización.

Los permisos efectivos se calculan por separado en `apps.permissions`.

## Pruebas

El directorio:

`apps/backend/apps/identity/tests`

solo contiene `__init__.py` en el estado revisado.

No se observó una suite backend específica para login/refresh/logout/me.

Tampoco se observó una suite frontend específica dentro de `modules/auth`.

## Pruebas prioritarias

Escenarios recomendados:

1. login válido;
2. credenciales inválidas;
3. usuario inactivo;
4. claims adicionales del refresh;
5. expiración del access token;
6. refresh válido;
7. refresh inválido;
8. comportamiento esperado de rotación;
9. logout y blacklist;
10. GET /me;
11. PATCH /me y campos permitidos;
12. limpieza completa ante 401;
13. sincronización de permisos al montar;
14. recuperación tras reload;
15. navegación login/private route;
16. XSS/token-storage threat model;
17. idioma del login.

## Limitaciones actuales

### Refresh no utilizado por frontend

El refresh token se almacena pero no se usa para mantener la sesión.

### ROTATE_REFRESH_TOKENS no aplicado por el flujo custom

La configuración existe, pero el endpoint custom devuelve solo access.

### Limpieza parcial ante 401

El interceptor elimina access token, pero deja refresh y user.

### PATCH /me demasiado amplio

Existe un contrato de escritura más permisivo que el endpoint Profile dedicado.

### Login sin i18n consistente

La pantalla mantiene strings directos.

### Tokens en localStorage

Es una decisión de arquitectura que debe evaluarse dentro del modelo de amenazas del despliegue.

### Sin tests dedicados

Los flujos centrales de autenticación no tienen cobertura específica observada en el repositorio.

## Regla de mantenimiento

Auth debe limitarse a:

- identidad de sesión;
- tokens;
- usuario autenticado;
- sincronización básica de estado.

La edición de perfil debe mantenerse en el contrato dedicado de Profile.

La autorización por dominio pertenece a Permissions y a los endpoints de cada módulo.
