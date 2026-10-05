# Arquitectura Frontend

## Stack

El frontend se encuentra en `apps/frontend`.

Tecnologías principales:

| Tecnología | Uso |
| --- | --- |
| React 18 | UI |
| TypeScript | Tipado |
| Vite 6 | Desarrollo y build |
| React Router 6 | Rutas |
| Zustand 5 | Estado global de autenticación |
| TanStack Query 5 | Estado de servidor en módulos que lo adoptan |
| Axios | Cliente HTTP |
| i18next | Internacionalización |
| Recharts | Gráficas |
| lucide-react | Iconografía |
| jsPDF / pdf-lib | Funciones PDF de cliente |

## Entrada de la aplicación

`main.tsx` monta React dentro de:

- `React.StrictMode`;
- `QueryClientProvider`.

También inicializa i18n y carga `styles/tokens.css`.

## Router

`App.tsx` utiliza `BrowserRouter`.

`/login` es la única ruta pública.

El resto de la aplicación está envuelto por `PrivateRoute`.

`PrivateRoute` comprueba solamente `isAuthenticated`.

No valida permisos por módulo ni rol para cada URL.

Por lo tanto, el control visual del sidebar no reemplaza la autorización del backend.

## Rutas activas

Áreas activas observadas:

- Dashboard raíz;
- Operational Panel;
- Production;
- Quality;
- Maintenance;
- Warehouse;
- Administration;
- Profile.

También existen placeholders explícitos para:

- Maintenance Orders;
- Maintenance Actions;
- Workcenter Detail;
- Plant Settings;
- Settings.

Los placeholders no deben documentarse como módulos funcionales.

## AppShell

`AppShell` compone:

- Sidebar;
- TopBar;
- UserMenu;
- contenido de página;
- ChatbotWidget de Calidad.

El contenido tiene un ancho máximo de 1600 px y scroll vertical independiente.

## Hallazgo de rol del Sidebar

El componente llama:

`<Sidebar userRole={"admin" as UserRole} />`

Por lo tanto, el rol enviado al sistema de navegación está hardcodeado como `admin` y no deriva del usuario autenticado.

`useSidebar` todavía aplica permisos efectivos por módulo, por lo que una sección sin permiso `view` puede quedar oculta.

Sin embargo, cualquier filtro puramente basado en `allowedRoles` evalúa al usuario como admin.

Esto es especialmente relevante para items como Q-Wall Settings.

La navegación debe corregirse para utilizar roles reales o eliminar el sistema paralelo de roles del sidebar.

## Sistema de roles del frontend

`navigation/types.ts` declara:

- operador;
- tecnico;
- lider;
- supervisor;
- ingeniero;
- admin;
- gerente.

El backend RBAC utiliza slugs diferentes y más específicos, por ejemplo:

- operator;
- supervisor;
- quality_engineer;
- process_engineer;
- maintenance_engineer;
- inventory_engineer;
- admin;
- plant_manager.

Existen por tanto dos taxonomías de roles.

La navegación mezcla además permisos efectivos del backend con este enum de roles legacy del frontend.

Una dirección de arquitectura más consistente es usar permisos `module.action` como autoridad y reservar roles para administración, no para lógica duplicada de visibilidad.

## Permisos

`authStore` conserva en cada usuario un mapa de permisos:

`module -> action[]`.

Módulos:

- production;
- quality;
- maintenance;
- warehouse;
- administration.

Acciones:

- view;
- create;
- edit;
- delete.

`hasPermission` consulta ese mapa.

`useSidebar` exige permiso `view` del módulo además del rol permitido por configuración.

## Rutas y permisos

Aunque el sidebar filtre secciones, `App.tsx` no contiene un `PermissionRoute`.

Un usuario autenticado puede navegar manualmente a una URL aunque el sidebar no la muestre.

La seguridad efectiva depende entonces del endpoint backend consumido por la página.

Esto es particularmente importante porque la revisión backend encontró endpoints que también usan únicamente `IsAuthenticated`.

La corrección debe realizarse primero en backend y, adicionalmente, puede incorporarse un guard frontend para UX.

## Estado de autenticación

`authStore.ts` utiliza Zustand.

Datos persistidos en localStorage:

- `mes_access_token`;
- `mes_refresh_token`;
- `mes_user`;
- `mes_language`.

`isAuthenticated` se inicializa si existen access token y usuario almacenado.

El store permite:

- setAuth;
- clearAuth;
- updateUser;
- hasPermission.

## Login y sesión

`AuthService` usa el cliente compartido.

Endpoints:

- `/auth/login/`;
- `/auth/logout/`;
- `/auth/me/`.

El refresh token se guarda en localStorage.

Sin embargo, `api.client.ts` no implementa un interceptor para renovar automáticamente el access token.

Ante HTTP 401:

1. elimina `mes_access_token`;
2. redirige a `/login`.

El refresh token y usuario almacenado no se eliminan en ese interceptor.

Por tanto, la existencia de refresh token no se utiliza actualmente para una renovación transparente de sesión.

El contrato completo de autenticación se documenta en `../modules/authentication.md`.

## Cliente HTTP

`services/api.client.ts` centraliza Axios.

Funciones:

- base URL;
- Content-Type JSON;
- serialización de query params;
- Bearer token;
- Accept-Language;
- manejo 401.

### Arrays en query params

El serializer personalizado repite keys:

`?bu=VOLVO&bu=CUMMINS`

Esto coincide con la lectura de arrays esperada por DRF y evita el formato `bu[]` predeterminado de algunas serializaciones Axios.

### Base URL

Existe una constante llamada `VITE_API_BASE_URL`, pero su valor está hardcodeado:

`http://localhost:8000/api/v1`.

No se lee `import.meta.env`.

Esto acopla el build al host local y debe sustituirse por configuración por ambiente antes de un despliegue independiente del navegador/servidor actual.

## Clientes HTTP paralelos

La mayor parte de platformSSI usa `apiClient`.

Algunos componentes paralelos SSI usan `axios` directamente.

Estos clientes no reciben automáticamente los interceptors de:

- JWT;
- idioma;
- serialización multi-value;
- manejo 401.

Cualquier módulo nuevo debe preferir el cliente compartido salvo que exista una razón documentada.

## TanStack Query

La aplicación crea un QueryClient global.

Su uso no es uniforme.

Módulos como los dashboards SSI paralelos lo utilizan para cachear estado de servidor en frontend.

Otros módulos manejan `useState` y llamadas manuales.

No debe confundirse el caché de TanStack Query con el caché Redis del backend.

## i18n

Idiomas configurados:

- español;
- inglés.

El idioma inicial se obtiene de `mes_language`.

Fallback: español.

El login actualiza activamente i18n según `preferred_language` del usuario.

El TopBar puede cambiar idioma y persiste el valor en localStorage.

Los recursos se encuentran bajo `src/i18n/locales/{lang}/common.json`.

## Theme

`useTheme` soporta:

- light;
- dark;
- system.

La selección se almacena en `mes_theme`.

El tema resuelto se aplica como `data-theme` en el elemento HTML.

Cuando la preferencia es `system`, el hook escucha cambios de `prefers-color-scheme`.

El diseño se basa en variables CSS de `tokens.css`.

## Navegación

`sidebarConfig.ts` define secciones, items, iconos, rutas y roles.

`useSidebar`:

- filtra por rol;
- filtra por permiso `view`;
- detecta la sección activa por URL;
- maneja accordion;
- maneja subgrupos;
- maneja modo colapsado.

El mapeo de sección a módulo considera Operational Panel como Production para permisos.

Para el detalle del dashboard transversal, sus fuentes, carga paralela y limitaciones, consultar `../modules/operational-panel.md`.

## Q-Wall group

Q-Wall se presenta como un subgrupo de Quality.

Incluye:

- report;
- dashboard;
- rejections;
- catalog;
- help;
- settings.

La visibilidad declarada de settings es admin/ingeniero, pero debido al rol hardcodeado de AppShell la evaluación de rol no representa al usuario real.

El backend de Q-Wall Settings sí realiza su propia validación para admin y quality_engineer.

## ChatbotWidget

`AppShell` monta globalmente el widget de chatbot de Calidad.

El backend actual del chatbot trabaja con preguntas predefinidas y un registry de servicios, no con un modelo generativo.

Por estar montado en AppShell, el componente existe en todas las páginas autenticadas aunque su contenido se relacione actualmente con Q-Wall.

## Estado de módulos no conectados

El repositorio contiene componentes frontend que no aparecen en `App.tsx`, por ejemplo:

- `ssi/attendance/AttendanceDashboard`;
- `ssi/chair-control/ChairDashboard`;
- `ssi/safe-launch/SafeLaunchTutorial`.

La presencia del archivo no implica una ruta activa.

## Build

Scripts definidos:

`npm run dev`

`npm run build`

`npm run preview`

`npm run lint`

El build ejecuta primero TypeScript y después Vite.

## Deuda técnica prioritaria

1. eliminar el rol `admin` hardcodeado de AppShell;
2. consolidar roles legacy del frontend con el RBAC backend;
3. agregar guards de permiso a rutas como mejora de UX;
4. mantener enforcement real en backend;
5. parametrizar API base URL por ambiente;
6. definir estrategia de refresh token;
7. retirar clientes Axios paralelos sin interceptors;
8. distinguir explícitamente módulos activos de componentes no montados.
