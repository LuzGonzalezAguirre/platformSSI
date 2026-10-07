import type { ActionKey, ModuleKey } from "../store/authStore";

export type Theme = "light" | "dark" | "system";

export type Language = "es" | "en";

export interface NavItem {
  id: string;
  labelKey: string;
  path: string;
  icon: string;
  requiredAction?: ActionKey;
  badge?: number;
  disabled?: boolean;
  children?: NavItem[];
}

export interface NavSection {
  id: string;
  labelKey: string;
  icon: string;
  module: ModuleKey;
  items: NavItem[];
  order: number;
}

export interface SidebarState {
  expandedSectionId: string | null;
  expandedSubGroupId: string | null;
  activeItemId: string | null;
  isCollapsed: boolean;
}

export type SidebarAction =
  | { type: "TOGGLE_SECTION"; sectionId: string }
  | { type: "SET_ACTIVE"; itemId: string; sectionId: string }
  | { type: "TOGGLE_COLLAPSE" }
  | { type: "EXPAND_SECTION"; sectionId: string }
  | { type: "TOGGLE_SUBGROUP"; subGroupId: string };

export interface UseSidebarReturn {
  state: SidebarState;
  visibleSections: NavSection[];
  toggleSection: (sectionId: string) => void;
  setActive: (itemId: string, sectionId: string) => void;
  toggleCollapse: () => void;
  toggleSubGroup: (subGroupId: string) => void;
  isSectionExpanded: (sectionId: string) => boolean;
  isSubGroupExpanded: (subGroupId: string) => boolean;
  isItemActive: (itemId: string) => boolean;
}

export interface UseThemeReturn {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}
