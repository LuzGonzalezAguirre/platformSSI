import apiClient from "../../../../services/api.client";

export interface FailureMode {
  id: number;
  name: string;
  fail_code: string;
  has_translation: boolean;
  has_image: boolean;
  image_data: string;
  image_mime: string;
  updated_at: string | null;
  updated_by: string | null;
}

export interface InspectionPoint {
  id: number;
  name: string;
  fail_modes: FailureMode[];
}

export interface BusinessUnit {
  id: number;
  name: string;
  inspection_points: InspectionPoint[];
}

export const failureCatalogApi = {
  getStructure: async (locale: string = "es"): Promise<BusinessUnit[]> => {
    const res = await apiClient.get("/quality/catalog/structure/", {
      params: { lang: locale },
    });
    return res.data.data;
  },

  saveImage: async (payload: {
    inspection_point: string;
    failure_mode: string;
    image_data: string;
    image_mime: string;
  }): Promise<void> => {
    await apiClient.post("/quality/catalog/", payload);
  },

  deleteImage: async (inspection_point: string, failure_mode: string): Promise<void> => {
    await apiClient.delete("/quality/catalog/", {
      data: { inspection_point, failure_mode },
    });
  },
};