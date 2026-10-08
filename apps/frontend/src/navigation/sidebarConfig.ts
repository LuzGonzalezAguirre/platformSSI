import { NavSection } from "./types";

export const sidebarConfig: NavSection[] = [
  {
    id: "operational-panel",
    module: "production",
    labelKey: "nav.sections.operationalPanel",
    icon: "MonitorDot",

    order: 0,
    items: [
      {
        id: "operational-panel.main",
        labelKey: "nav.items.operationalPanel",
        path: "/operational-panel",
        icon: "LayoutDashboard",

      },
      
    
    ],
  },
  {
    id: "production",
    module: "production",
    labelKey: "nav.sections.production",
    icon: "Factory",

    order: 1,
    items: [
      {
        id: "production.ops-daily-report",
        labelKey: "nav.items.productionOpsDaily",
        path: "/production/ops-daily-report",
        icon: "ClipboardList",

      },
      {
        id: "production.targets",
        labelKey: "nav.items.productionTargets",
        path: "/production/targets",
        icon: "Target",

      },
      {
        id: "production.safety",
        labelKey: "nav.items.productionSafety",
        path: "/production/safety",
        icon: "ShieldAlert",

      },
      {
        id: "production.assistance",
        labelKey: "nav.items.productionAssistance",
        path: "/production/assistance",
        icon: "HandHelping",

      },
      {
        id: "production.leysilla",
        labelKey: "nav.items.productionLeysilla",
        path: "/production/leysilla",
        icon: "Armchair",

      },
    ],
  },
  {
    id: "quality",
    module: "quality",
    labelKey: "nav.sections.quality",
    icon: "BadgeCheck",

    order: 2,
    items: [
      {
        id: "quality.dashboard",
        labelKey: "nav.items.qualityDashboard",
        path: "/quality/dashboard",
        icon: "ShieldCheck",

      },
      {
        id: "quality.problems",
        labelKey: "nav.items.qualityProblems",
        path: "/quality/problems",
        icon: "AlertTriangle",

      },
      {
        id: "quality.incoming-inspection",
        labelKey: "nav.items.qualityIncomingInspection",
        path: "/quality/incoming-inspection",
        icon: "PackageSearch",

      },  
      {
  id: "quality.downtime",
  labelKey: "nav.items.qualityDowntime",
  path: "/quality/downtime",
  icon: "Clock",

},
      {
      id: "quality.cogp",
      labelKey: "nav.items.qualityCogp",
      path: "/quality/cogp",
      icon: "TrendingDown",

    },
      {
        id: "quality.qwall-group",
        labelKey: "nav.items.qualityQwallGroup",
        path: "",
        icon: "ClipboardCheck",

        children: [
          {
            id: "quality.qwall",
            labelKey: "nav.items.qualityQwallReport",
            path: "/quality/qwall",
            icon: "FileText",

          },
          {
            id: "quality.qwall-dashboard",
            labelKey: "nav.items.qualityQwallDashboard",
            path: "/quality/qwall-dashboard",
            icon: "BarChart2",

          },
          {
            id: "quality.rejections",
            labelKey: "nav.items.qualityRejections",
            path: "/quality/rejections",
            icon: "XCircle",

          },
          {
            id: "quality.qwall-catalog",
            labelKey: "nav.items.qualityQwallCatalog",
            path: "/quality/qwall/catalog",
            icon: "BookOpen",

          },
          
          {
            id: "quality.qwall-designer",
            requiredAction: "edit",
            labelKey: "nav.items.qwallDesigner",
            path: "/quality/qwall/designer",
            icon: "PanelsTopLeft",
          },
          {
            id: "quality.qwall-help",
            labelKey: "nav.items.qualityQwallHelp",
            path: "/quality/qwall/help",
            icon: "HelpCircle",

          },
          {
            id: "quality.qwall-settings",
            requiredAction: "edit",
            labelKey: "nav.items.qwallSettings",
            path: "/quality/qwall/settings",
            icon: "Settings2",

          },
        ],
      },
    ],
  },
  {
    id: "maintenance",
    module: "maintenance",
    labelKey: "nav.sections.maintenance",
    icon: "Wrench",

    order: 3,
    items: [
      {
        id: "maintenance.overview",
        labelKey: "nav.items.maintenanceOverview",
        path: "/maintenance/overview",
        icon: "LayoutDashboard",

      },
      {
        id: "maintenance.work-requests",
        labelKey: "nav.items.maintenanceWorkRequests",
        path: "/maintenance/work-requests",
        icon: "ClipboardList",

      },
      {
        id: "maintenance.pmp",
        labelKey: "nav.items.maintenancePmp",
        path: "/maintenance/pmp",
        icon: "CalendarDays",

      },
      {
        id: "maintenance.down-equipment",
        labelKey: "nav.items.maintenanceDownEquipment",
        path: "/maintenance/down-equipment",
        icon: "Siren",

      },
    ],
  },
  {
    id: "warehouse",
    module: "warehouse",
    labelKey: "nav.sections.warehouse",
    icon: "Warehouse",

    order: 4,
    items: [
      {
        id: "warehouse.bom",
        labelKey: "nav.items.warehouseBom",
        path: "/warehouse/ctb",
        icon: "GitBranch",

      },
      {
        id: "warehouse.demand",
        labelKey: "nav.items.warehouseDemand",
        path: "/warehouse/demand",
        icon: "ClipboardList",

      },
    ],
  },
  {
    id: "administration",
    module: "administration",
    labelKey: "nav.sections.administration",
    icon: "ShieldCheck",

    order: 5,
    items: [
      {
        id: "administration.users",
        labelKey: "nav.items.adminUsers",
        path: "/settings/users",
        icon: "Users",

      },
      {
        id: "administration.roles",
        labelKey: "nav.items.adminRoles",
        path: "/settings/roles",
        icon: "Lock",

      },
      {
        id: "administration.audit",
        labelKey: "nav.items.adminAudit",
        path: "/settings/audit",
        icon: "ShieldAlert",

      },
    ],
  },
];