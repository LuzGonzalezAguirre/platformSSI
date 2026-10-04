# Frontend Architecture

## 1. Technology baseline

The PlatformSSI frontend is a React 18 TypeScript application built with Vite.

| Capability | Technology |
|---|---|
| UI framework | React 18.3.1 |
| Language | TypeScript 5.7 |
| Build tooling | Vite 6 |
| Routing | react-router-dom 6.28 |
| HTTP client | Axios 1.7 |
| Server-state management | TanStack React Query 5 |
| Local client state | Zustand 5 |
| Charts | Recharts 3 |
| Internationalization | i18next and react-i18next |
| PDF handling | jsPDF, jsPDF AutoTable and pdf-lib |
| Icons available in codebase | lucide-react |

The use of lucide-react is an application dependency. This technical documentation does not use decorative iconography.

## 2. Application entry point

main.tsx initializes React, loads internationalization, imports the shared design tokens and wraps the application in QueryClientProvider.

React StrictMode is enabled.

## 3. Routing

App.tsx contains the top-level browser router and protected application routes.

The login page is the only explicitly public route represented in the main router. Authenticated routes are wrapped in PrivateRoute, which checks the Zustand authentication store.

Unknown routes are redirected to the application root.

## 4. Authentication state

Authentication state is read from useAuthStore.

The router uses isAuthenticated to decide whether the login page or the protected application shell should be rendered.

The authenticated dashboard displays information from the user object such as full name, role display and plant when available.

## 5. Server-state handling

TanStack React Query is initialized globally through QueryClientProvider.

Module-specific API code and services use HTTP calls to the backend. The frontend build receives VITE_API_BASE_URL from environment configuration. The Docker development composition points this value to http://localhost:8000/api/v1.

## 6. Navigation and roles

The sidebar defines seven role identifiers.

| Role |
|---|
| operador |
| tecnico |
| lider |
| supervisor |
| ingeniero |
| admin |
| gerente |

General production, quality, maintenance and operational-panel navigation is available to all configured roles.

Warehouse demand is restricted in sidebar configuration to supervisory roles.

Administration is restricted to admin.

Q-Wall settings are restricted in sidebar configuration to admin and ingeniero.

Frontend navigation restrictions should not be considered the sole authorization control. Backend permission enforcement remains the authoritative security boundary.

## 7. Main frontend modules

| Module | Current route-level scope |
|---|---|
| operational-panel | Operational dashboard |
| production | OPS daily report, targets, safety, assistance and chair-related functionality |
| quality | Dashboard, Problem Control, incoming inspection, downtime, COGP, Q-Wall and rejection functions |
| maintenance | Overview, work requests, PMP, down equipment and corrective actions |
| warehouse | Clear-to-build and demand |
| admin | Users, roles and audit |
| profile | User profile |
| notifications | Notification-related interface |
| qwall-settings | Q-Wall configuration |
| ssi | Additional SSI attendance, chair-control and safe-launch modules |

## 8. Placeholder and partial routes

The main router includes placeholder views for maintenance orders, maintenance actions, workcenter detail, plant settings and general settings.

These routes are part of the current frontend state but are not complete functional implementations.

## 9. Quality frontend scope

The quality area has the largest route set in the current frontend.

It includes Quality Dashboard, Quality Panel, Q-Wall report, Q-Wall dashboard, rejection report, COGP dashboard, COGP mapping, downtime settings, downtime view, scrap rate, incoming inspection and Problem Control.

Problem Control has dedicated list, creation wizard, detail, edit and approval routes.

## 10. Shared frontend concerns

The repository includes shared directories for components, internationalization, library utilities, navigation, services, store and styles.

Shared design values are loaded from styles/tokens.css.

The navigation implementation is configuration-driven through sidebarConfig.ts and role-aware hooks.

## 11. Current-state boundary

The current frontend architecture provides route protection and role-aware navigation but the complete permission behavior must be documented together with backend authorization.

No frontend-wide observability, distributed tracing or standardized error telemetry layer is established in the files reviewed for this architecture baseline.
