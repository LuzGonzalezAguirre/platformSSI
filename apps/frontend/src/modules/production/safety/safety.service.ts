import apiClient from "../../../services/api.client";
import {
  SafetySettings, SafetyIncident, SafetyCounterEvent,
  SafetyIncidentCreatePayload, SafetyIncidentFilters,
  SafetySettingsUpdatePayload,
} from "./types";

const BASE = "/production";

export const SafetyService = {
  getSettings: (plant = "Tijuana"): Promise<SafetySettings> =>
    apiClient.get(`${BASE}/safety/settings/`, { params: { plant } }).then((r: any) => r.data),

  updateSettings: (
    payload: SafetySettingsUpdatePayload,
    plant = "Tijuana",
  ): Promise<SafetySettings> =>
    apiClient
      .patch(`${BASE}/safety/settings/`, payload, { params: { plant } })
      .then((r: any) => r.data),

  listIncidents: (filters?: SafetyIncidentFilters): Promise<SafetyIncident[]> =>
    apiClient.get(`${BASE}/safety/incidents/`, { params: filters }).then((r: any) => r.data),

  createIncident: (payload: SafetyIncidentCreatePayload): Promise<SafetyIncident> =>
    apiClient.post(`${BASE}/safety/incidents/`, payload).then((r: any) => r.data),

  updateIncidentStatus: (id: number, status: string): Promise<SafetyIncident> =>
    apiClient.patch(`${BASE}/safety/incidents/${id}/`, { status }).then((r: any) => r.data),

  getCounterHistory: (plant = "Tijuana"): Promise<SafetyCounterEvent[]> =>
    apiClient
      .get(`${BASE}/safety/counter-history/`, { params: { plant } })
      .then((r: any) => r.data),
};