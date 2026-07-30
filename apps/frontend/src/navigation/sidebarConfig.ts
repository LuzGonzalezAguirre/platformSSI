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
    id: "operational-panel",
    labelKey: "nav.sections.operationalPanel",
    icon: "MonitorDot",
    allowedRoles: ALL_ROLES,
    order: 0,
    items: [
      {
        id: "operational-panel.main",
        labelKey: "nav.items.operationalPanel",
        path: "/operational-panel",
        icon: "LayoutDashboard",
        allowedRoles: ALL_ROLES,
      },
      {
      id: "operational-panel.cogp",
      labelKey: "nav.items.qualityCogp",
      path: "/quality/cogp",
      icon: "TrendingDown",
      allowedRoles: ALL_ROLES,
    },
    
    ],
  },
  {
    id: "production",
    labelKey: "nav.sections.production",
    icon: "Factory",
    allowedRoles: ALL_ROLES,
    order: 1,
    items: [
      {
        id: "production.ops-daily-report",
        labelKey: "nav.items.productionOpsDaily",
        path: "/production/ops-daily-report",
        icon: "ClipboardList",
        allowedRoles: ALL_ROLES,
      },
      {
        id: "production.targets",
        labelKey: "nav.items.productionTargets",
        path: "/production/targets",
        icon: "Target",
        allowedRoles: ALL_ROLES,
      },
      {
        id: "production.safety",
        labelKey: "nav.items.productionSafety",
        path: "/production/safety",
        icon: "ShieldAlert",
        allowedRoles: ALL_ROLES,
      },
      {
        id: "production.assistance",
        labelKey: "nav.items.productionAssistance",
        path: "/production/assistance",
        icon: "HandHelping",
        allowedRoles: ALL_ROLES,
      },
      {
        id: "production.leysilla",
        labelKey: "nav.items.productionLeysilla",
        path: "/production/leysilla",
        icon: "Armchair",
        allowedRoles: ALL_ROLES,
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
        id: "quality.dashboard",
        labelKey: "nav.items.qualityDashboard",
        path: "/quality/dashboard",
        icon: "ShieldCheck",
        allowedRoles: ALL_ROLES,
      },
      {
        id: "quality.problems",
        labelKey: "nav.items.qualityProblems",
        path: "/quality/problems",
        icon: "AlertTriangle",
        allowedRoles: ALL_ROLES,
      },
      {
        id: "quality.incoming-inspection",
        labelKey: "nav.items.qualityIncomingInspection",
        path: "/quality/incoming-inspection",
        icon: "PackageSearch",
        allowedRoles: ALL_ROLES,
      },  
      {
  id: "quality.downtime",
  labelKey: "nav.items.qualityDowntime",
  path: "/quality/downtime",
  icon: "Clock",
  allowedRoles: ALL_ROLES,
},{
        id: "quality.scrap-rate",
        labelKey: "nav.items.qualityScrapRate",
        path: "/quality/scrap-rate",
        icon: "BarChart3",
        allowedRoles: SUPERVISORY_ROLES,
      },
      {
        id: "quality.qwall-group",
        labelKey: "nav.items.qualityQwallGroup",
        path: "",
        icon: "ClipboardCheck",
        allowedRoles: ALL_ROLES,
        children: [
          {
            id: "quality.qwall",
            labelKey: "nav.items.qualityQwallReport",
            path: "/quality/qwall",
            icon: "FileText",
            allowedRoles: ALL_ROLES,
          },
          {
            id: "quality.qwall-dashboard",
            labelKey: "nav.items.qualityQwallDashboard",
            path: "/quality/qwall-dashboard",
            icon: "BarChart2",
            allowedRoles: ALL_ROLES,
          },
          {
            id: "quality.rejections",
            labelKey: "nav.items.qualityRejections",
            path: "/quality/rejections",
            icon: "XCircle",
            allowedRoles: ALL_ROLES,
          },
          {
            id: "quality.qwall-catalog",
            labelKey: "nav.items.qualityQwallCatalog",
            path: "/quality/qwall/catalog",
            icon: "BookOpen",
            allowedRoles: ALL_ROLES,
          },
          
          {
            id: "quality.qwall-help",
            labelKey: "nav.items.qualityQwallHelp",
            path: "/quality/qwall/help",
            icon: "HelpCircle",
            allowedRoles: ALL_ROLES,
          },
          {
            id: "quality.qwall-settings",
            labelKey: "nav.items.qwallSettings",
            path: "/quality/qwall/settings",
            icon: "Settings2",
            allowedRoles: ["admin", "ingeniero"],
          },
        ],
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
        id: "maintenance.overview",
        labelKey: "nav.items.maintenanceOverview",
        path: "/maintenance/overview",
        icon: "LayoutDashboard",
        allowedRoles: ALL_ROLES,
      },
      {
        id: "maintenance.work-requests",
        labelKey: "nav.items.maintenanceWorkRequests",
        path: "/maintenance/work-requests",
        icon: "ClipboardList",
        allowedRoles: ALL_ROLES,
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
        path: "/warehouse/ctb",
        icon: "GitBranch",
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
      {
        id: "administration.audit",
        labelKey: "nav.items.adminAudit",
        path: "/settings/audit",
        icon: "ShieldAlert",
        allowedRoles: ADMIN_ROLES,
      },
    ],
  },
];