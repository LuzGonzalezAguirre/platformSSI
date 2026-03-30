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
}

export interface DemandRow {
  Customer: string;
  PO_Rel: string;
  PO_Status: string;
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

  async getDemand(customerNo: number | null, status: string): Promise<DemandRow[]> {
    const params: Record<string, any> = { status };
    if (customerNo !== null) params.customer_no = customerNo;
    const res = await apiClient.get(`/warehouse/demand/`, { params });
    return res.data;
  },
};