export type UserRole =
  | "operador"
  | "tecnico"
  | "lider"
  | "supervisor"
  | "ingeniero"
  | "admin"
  | "gerente";

export type Theme = "light" | "dark" | "system";

export type Language = "es" | "en";

// Un item individual dentro de una seccion
export interface NavItem {
  id: string;
  labelKey: string;         // clave i18n: "nav.dashboard"
  path: string;             // ruta React Router
  icon: string;             // nombre del icono (string, el componente lo resuelve)
  allowedRoles: UserRole[]; // roles que pueden ver este item
  badge?: number;           // notificaciones opcionales
  disabled?: boolean;
}

// Una seccion del sidebar (accordion)
export interface NavSection {
  id: string;
  labelKey: string;
  icon: string;
  allowedRoles: UserRole[];
  items: NavItem[];
  order: number;            // para ordenar secciones
}

// Estado del sidebar
export interface SidebarState {
  expandedSectionId: string | null;
  activeItemId: string | null;
  isCollapsed: boolean;     // sidebar colapsado a solo iconos
}

// Accion del sidebar
export type SidebarAction =
  | { type: "TOGGLE_SECTION"; sectionId: string }
  | { type: "SET_ACTIVE"; itemId: string; sectionId: string }
  | { type: "TOGGLE_COLLAPSE" }
  | { type: "EXPAND_SECTION"; sectionId: string };

// Resultado del hook useSidebar
export interface UseSidebarReturn {
  state: SidebarState;
  visibleSections: NavSection[];
  toggleSection: (sectionId: string) => void;
  setActive: (itemId: string, sectionId: string) => void;
  toggleCollapse: () => void;
  isSectionExpanded: (sectionId: string) => boolean;
  isItemActive: (itemId: string) => boolean;
}

// Resultado del hook useTheme
export interface UseThemeReturn {
  theme: Theme;
  resolvedTheme: "light" | "dark"; // tema real aplicado (system resuelto)
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}