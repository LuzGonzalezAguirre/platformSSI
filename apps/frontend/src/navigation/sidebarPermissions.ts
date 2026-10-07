import type { UserPermissions } from "../store/authStore";
import type { NavItem, NavSection } from "./types";

function hasAction(
  permissions: UserPermissions | undefined,
  module: NavSection["module"],
  action: NavItem["requiredAction"] = "view",
): boolean {
  return permissions?.[module]?.includes(action) ?? false;
}

function filterItem(
  item: NavItem,
  module: NavSection["module"],
  permissions: UserPermissions | undefined,
): NavItem | null {
  if (item.children) {
    const children = item.children
      .map((child) => filterItem(child, module, permissions))
      .filter((child): child is NavItem => child !== null);

    if (children.length === 0) return null;
    return { ...item, children };
  }

  return hasAction(permissions, module, item.requiredAction) ? item : null;
}

export function filterSectionsByPermissions(
  sections: NavSection[],
  permissions: UserPermissions | undefined,
): NavSection[] {
  return sections
    .filter((section) => hasAction(permissions, section.module, "view"))
    .map((section) => ({
      ...section,
      items: section.items
        .map((item) => filterItem(item, section.module, permissions))
        .filter((item): item is NavItem => item !== null),
    }))
    .filter((section) => section.items.length > 0)
    .sort((a, b) => a.order - b.order);
}
