import { useReducer, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  SidebarState,
  SidebarAction,
  NavSection,
  UserRole,
  UseSidebarReturn,
} from "./types";
import { sidebarConfig } from "./sidebarConfig";
import { useAuthStore, UserPermissions, ModuleKey } from "../store/authStore";

const initialState: SidebarState = {
  expandedSectionId: null,
  activeItemId: null,
  isCollapsed: false,
};

function sidebarReducer(state: SidebarState, action: SidebarAction): SidebarState {
  switch (action.type) {
    case "TOGGLE_SECTION":
      return {
        ...state,
        expandedSectionId:
          state.expandedSectionId === action.sectionId ? null : action.sectionId,
      };
    case "EXPAND_SECTION":
      return { ...state, expandedSectionId: action.sectionId };
    case "SET_ACTIVE":
      return { ...state, activeItemId: action.itemId, expandedSectionId: action.sectionId };
    case "TOGGLE_COLLAPSE":
      return {
        ...state,
        isCollapsed: !state.isCollapsed,
        expandedSectionId: !state.isCollapsed ? null : state.expandedSectionId,
      };
    default:
      return state;
  }
}

// Mapeo sección → módulo de permisos
const SECTION_MODULE_MAP: Record<string, ModuleKey> = {
  "operational-panel": "production", 
  production:     "production",
  quality:        "quality",
  maintenance:    "maintenance",
  warehouse:      "warehouse",
  administration: "administration",
};

function filterSectionsByPermissions(
  sections: NavSection[],
  userRole: UserRole,
  permissions: UserPermissions | undefined,
): NavSection[] {
  return sections
    .filter((section) => {
      // Primero filtra por rol (acceso mínimo)
      if (!section.allowedRoles.includes(userRole)) return false;

      // Luego verifica que tenga al menos "view" en ese módulo
      const module = SECTION_MODULE_MAP[section.id];
      if (!module || !permissions) return false;
      return permissions[module]?.includes("view") ?? false;
    })
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.allowedRoles.includes(userRole)),
    }))
    .filter((section) => section.items.length > 0)
    .sort((a, b) => a.order - b.order);
}

function findSectionByPath(sections: NavSection[], path: string): string | null {
  for (const section of sections) {
    if (section.items.find((item) => path.startsWith(item.path))) return section.id;
  }
  return null;
}

function findItemByPath(sections: NavSection[], path: string): string | null {
  for (const section of sections) {
    const match = section.items.find((item) => path.startsWith(item.path));
    if (match) return match.id;
  }
  return null;
}

export function useSidebar(userRole: UserRole): UseSidebarReturn {
  const location = useLocation();
  const [state, dispatch] = useReducer(sidebarReducer, initialState);
  const permissions = useAuthStore((s) => s.user?.permissions);

  const visibleSections = useMemo(
    () => filterSectionsByPermissions(sidebarConfig, userRole, permissions),
    [userRole, permissions],
  );

  const activeSectionId = useMemo(
    () => findSectionByPath(visibleSections, location.pathname),
    [visibleSections, location.pathname],
  );

  const activeItemId = useMemo(
    () => findItemByPath(visibleSections, location.pathname),
    [visibleSections, location.pathname],
  );

  const effectiveState: SidebarState = {
    ...state,
    expandedSectionId: state.expandedSectionId ?? activeSectionId,
    activeItemId: state.activeItemId ?? activeItemId,
  };

  const toggleSection = useCallback((sectionId: string) => {
    dispatch({ type: "TOGGLE_SECTION", sectionId });
  }, []);

  const setActive = useCallback((itemId: string, sectionId: string) => {
    dispatch({ type: "SET_ACTIVE", itemId, sectionId });
  }, []);

  const toggleCollapse = useCallback(() => {
    dispatch({ type: "TOGGLE_COLLAPSE" });
  }, []);

  const isSectionExpanded = useCallback(
    (sectionId: string) => effectiveState.expandedSectionId === sectionId,
    [effectiveState.expandedSectionId],
  );

  const isItemActive = useCallback(
    (itemId: string) => effectiveState.activeItemId === itemId,
    [effectiveState.activeItemId],
  );

  return {
    state: effectiveState,
    visibleSections,
    toggleSection,
    setActive,
    toggleCollapse,
    isSectionExpanded,
    isItemActive,
  };
}