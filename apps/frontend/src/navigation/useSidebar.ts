import { useReducer, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  SidebarState,
  SidebarAction,
  NavSection,
  UseSidebarReturn,
} from "./types";
import { sidebarConfig } from "./sidebarConfig";
import { filterSectionsByPermissions } from "./sidebarPermissions";
import { useAuthStore } from "../store/authStore";

const initialState: SidebarState = {
  expandedSectionId: null,
  expandedSubGroupId: null,
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
    case "TOGGLE_SUBGROUP":
      return {
        ...state,
        expandedSubGroupId:
          state.expandedSubGroupId === action.subGroupId ? null : action.subGroupId,
      };
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

function findSectionByPath(sections: NavSection[], path: string): string | null {
  for (const section of sections) {
    for (const item of section.items) {
      if (item.path && path.startsWith(item.path)) return section.id;
      if (item.children?.find((c) => c.path && path.startsWith(c.path))) return section.id;
    }
  }
  return null;
}

function findSubGroupByPath(sections: NavSection[], path: string): string | null {
  for (const section of sections) {
    for (const item of section.items) {
      if (item.children?.find((c) => c.path && path.startsWith(c.path))) return item.id;
    }
  }
  return null;
}

function findItemByPath(sections: NavSection[], path: string): string | null {
  for (const section of sections) {
    for (const item of section.items) {
      if (item.path && path.startsWith(item.path)) return item.id;
      const child = item.children?.find((c) => c.path && path.startsWith(c.path));
      if (child) return child.id;
    }
  }
  return null;
}

export function useSidebar(): UseSidebarReturn {
  const location = useLocation();
  const [state, dispatch] = useReducer(sidebarReducer, initialState);
  const permissions = useAuthStore((s) => s.user?.permissions);

  const visibleSections = useMemo(
    () => filterSectionsByPermissions(sidebarConfig, permissions),
    [permissions],
  );

  const activeSectionId = useMemo(
    () => findSectionByPath(visibleSections, location.pathname),
    [visibleSections, location.pathname],
  );

  const activeSubGroupId = useMemo(
    () => findSubGroupByPath(visibleSections, location.pathname),
    [visibleSections, location.pathname],
  );

  const activeItemId = useMemo(
    () => findItemByPath(visibleSections, location.pathname),
    [visibleSections, location.pathname],
  );

  const effectiveState: SidebarState = {
    ...state,
    expandedSectionId: state.expandedSectionId ?? activeSectionId,
    expandedSubGroupId: state.expandedSubGroupId ?? activeSubGroupId,
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

  const toggleSubGroup = useCallback((subGroupId: string) => {
    dispatch({ type: "TOGGLE_SUBGROUP", subGroupId });
  }, []);

  const isSectionExpanded = useCallback(
    (sectionId: string) => effectiveState.expandedSectionId === sectionId,
    [effectiveState.expandedSectionId],
  );

  const isSubGroupExpanded = useCallback(
    (subGroupId: string) => effectiveState.expandedSubGroupId === subGroupId,
    [effectiveState.expandedSubGroupId],
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
    toggleSubGroup,
    isSectionExpanded,
    isSubGroupExpanded,
    isItemActive,
  };
}