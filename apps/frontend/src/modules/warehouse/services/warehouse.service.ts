import apiClient from "../../../services/api.client";

export interface PartRevision {
  Part_No: string;
  Revision: string;
  Part_Name: string;
}

export interface BomRow {
  level: number;
  original_part_no: string;
  original_part_name: string;
  part_no_rev: string;
  part_name: string;
  quantity: number;
  unit: string;
  note: string;
  bom_path: string;
}

export interface CtbRow {
  level: number;
  root_part_no_rev: string;
  part_no_rev: string;
  part_name: string;
  bom_qty: number;
  unit: string;
  need: number;
  ohymv: number;
  wip: number;
  inv: number;
  ohnv: number;
  ctb: "Yes" | "No";
  bom_path: string;
  note: string;
  is_latest_revision: boolean;
  active_revision: string;
}

export interface DemandRow {
  Customer: string;
  PO_Rel: string;
  PO_Status: string;
  Ship_To_Carrier?: string;
  Shipper_No?: string;
  Requested_Ship_Date?: string | null;
  Total_Rel_Due?: number | null;
  Part_No_Rev: string;
  Cust_Part: string;
  Qty_Ready: number;
  Qty_WIP: number;
  Ship_Date: string | null;
  Due_Date: string | null;
  Rel_Qty: number;
  Shipped: number;
  Rel_Bal: number;
  Rel_Status: string;
  Rel_Type: string;
}

export interface DemandFilters {
  customerNo: number | null;
  status: "Open" | "History" | "All";
  shipDateFrom?: string;
  shipDateTo?: string;
  po?: string;
  customerPartNo?: string;
  releaseTypes?: string[];
}

export const DEMAND_RELEASE_TYPES = [
  "Firm (862)", "CZ Ship", "Forecast", "HOLD", "Non-MRP Release",
  "Pass Through", "Planning (830)", "Projected", "Ramp Plan",
];

export const CUSTOMERS = [
  { label: "All Customers", value: null },
  { label: "Autocar",       value: 332159 },
  { label: "Capacity",      value: 768299 },
  { label: "Claas",         value: 338766 },
  { label: "Cummins",       value: 332165 },
  { label: "Elkamet",       value: 332169 },
  { label: "Elkhart",       value: 332170 },
  { label: "Girtz",         value: 773112 },
  { label: "JLG",           value: 332183 },
  { label: "Kautex",        value: 332185 },
  { label: "SSI-Plainfield",value: 332205 },
  { label: "Volvo",         value: 332211 },
];

export const WarehouseService = {
  async getPartRevisions(partNo: string): Promise<PartRevision[]> {
    const res = await apiClient.get(`/warehouse/parts/${partNo}/revisions/`);
    return res.data;
  },

  async getBomHierarchy(partNo: string, revision: string): Promise<BomRow[]> {
    const res = await apiClient.get(`/warehouse/parts/${partNo}/bom/${revision}/`);
    return res.data;
  },

  async getBomCtb(partNo: string, revision: string, need: number): Promise<CtbRow[]> {
    const res = await apiClient.get(`/warehouse/parts/${partNo}/ctb/${revision}/`, {
      params: { need },
    });
    return res.data;
  },

  async getDemand(filters: DemandFilters): Promise<DemandRow[]> {
    const params = new URLSearchParams({ status: filters.status });
    if (filters.customerNo !== null) params.set("customer_no", String(filters.customerNo));
    if (filters.shipDateFrom && filters.shipDateTo) {
      params.set("ship_date_from", filters.shipDateFrom);
      params.set("ship_date_to", filters.shipDateTo);
    }
    if (filters.po?.trim()) params.set("po", filters.po.trim());
    if (filters.customerPartNo?.trim()) params.set("customer_part_no", filters.customerPartNo.trim());
    for (const releaseType of filters.releaseTypes ?? []) {
      params.append("release_types", releaseType);
    }
    const res = await apiClient.get(`/warehouse/demand/?${params.toString()}`);
    return res.data;
  },
};