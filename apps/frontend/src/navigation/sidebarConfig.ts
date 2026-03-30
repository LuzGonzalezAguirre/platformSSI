import { NavSection, UserRole } from "./types";

const ALL_ROLES: UserRole[] = [
  "operador", "tecnico", "lider", "supervisor",
  "ingeniero", "admin", "gerente",
];

const SUPERVISORY_ROLES: UserRole[] = [
  "lider", "supervisor", "ingeniero", "admin", "gerente",
];

const ADMIN_ROLES: UserRole[] = ["admin"];

export const sidebarConfig: NavSection[] = [
  {
    id: "production",
    labelKey: "nav.sections.production",
    icon: "Factory",
    allowedRoles: ALL_ROLES,
    order: 1,
    items: [
      {
        id: "production.dashboard",
        labelKey: "nav.items.productionDashboard",
        path: "/production",
        icon: "LayoutDashboard",
        allowedRoles: ALL_ROLES,
      },
      {
        id: "production.orders",
        labelKey: "nav.items.productionOrders",
        path: "/production/orders",
        icon: "ClipboardList",
        allowedRoles: ALL_ROLES,
      },
      {
        id: "production.events",
        labelKey: "nav.items.productionEvents",
        path: "/production/events",
        icon: "ActivitySquare",
        allowedRoles: SUPERVISORY_ROLES,
      },
    ],
  },
  {
    id: "quality",
    labelKey: "nav.sections.quality",
    icon: "BadgeCheck",
    allowedRoles: ALL_ROLES,
    order: 2,
    items: [
      {
        id: "quality.inspections",
        labelKey: "nav.items.qualityInspections",
        path: "/quality/inspections",
        icon: "ClipboardCheck",
        allowedRoles: ALL_ROLES,
      },
      {
        id: "quality.defects",
        labelKey: "nav.items.qualityDefects",
        path: "/quality/defects",
        icon: "AlertTriangle",
        allowedRoles: SUPERVISORY_ROLES,
      },
    ],
  },
  {
    id: "maintenance",
    labelKey: "nav.sections.maintenance",
    icon: "Wrench",
    allowedRoles: ALL_ROLES,
    order: 3,
    items: [
      {
        id: "maintenance.orders",
        labelKey: "nav.items.maintenanceOrders",
        path: "/maintenance/orders",
        icon: "ScrollText",
        allowedRoles: ALL_ROLES,
      },
      {
        id: "maintenance.assets",
        labelKey: "nav.items.maintenanceAssets",
        path: "/maintenance/assets",
        icon: "Cpu",
        allowedRoles: SUPERVISORY_ROLES,
      },
    ],
  },
  {
    id: "warehouse",
    labelKey: "nav.sections.warehouse",
    icon: "Warehouse",
    allowedRoles: ALL_ROLES,
    order: 4,
    items: [
      {
        id: "warehouse.bom",
        labelKey: "nav.items.warehouseBom",
        path: "/warehouse/bom",
        icon: "GitBranch",
        allowedRoles: ALL_ROLES,
      },
      {
        id: "warehouse.ctb",
        labelKey: "nav.items.warehouseCtb",
        path: "/warehouse/ctb",
        icon: "PackageSearch",
        allowedRoles: ALL_ROLES,
      },
      {
        id: "warehouse.demand",
        labelKey: "nav.items.warehouseDemand",
        path: "/warehouse/demand",
        icon: "ClipboardList",
        allowedRoles: SUPERVISORY_ROLES,
      },
    ],
  },
  {
    id: "administration",
    labelKey: "nav.sections.administration",
    icon: "ShieldCheck",
    allowedRoles: ADMIN_ROLES,
    order: 5,
    items: [
      {
        id: "administration.users",
        labelKey: "nav.items.adminUsers",
        path: "/settings/users",
        icon: "Users",
        allowedRoles: ADMIN_ROLES,
      },
      {
        id: "administration.roles",
        labelKey: "nav.items.adminRoles",
        path: "/settings/roles",
        icon: "Lock",
        allowedRoles: ADMIN_ROLES,
      },
    ],
  },
];