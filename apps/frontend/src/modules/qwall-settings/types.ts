export interface BusinessUnit {
  bu_id: number;
  bu_name: string;
}

export interface QWallRole {
  role_id: number;
  role_name: string;
}

export interface QWallUser {
  user_id: number;
  name: string;
  barcode_id: string;
  role_id: number;
  role_name: string;
  is_active: number;
  created_at: string | null;
}

export interface PartNumber {
  pn_id: number;
  ssiPN: string;
  volvoProductNumber: string;
  bu_id: number;
  bu_name: string;
}

export interface InspectionPoint {
  inspection_point_id: number;
  point_name: string;
  bu_id: number;
  bu_name: string;
  sequence_order: number;
  is_active: number;
  fail_modes_list: string;
}

export interface FailMode {
  fail_mode_id: number;
  fail_code: string;
  description: string;
  is_active: number;
  assigned_points: string;
}

export interface SystemConfig {
  config_key: string;
  config_value: string;
}

export interface FailModeWithTranslation extends FailMode {
  translated_name: string | null;
  has_translation: boolean;
}

// ── Scan Rules ────────────────────────────────────────────────────────────────

export type FieldTarget = 'frameSN' | 'volvoSerialNumber' | 'descartado'

export type ExtractionMode =
  | 'completo'
  | 'por_separador'
  | 'pegado_longitud'
  | 'segmento'

export type Separator =
  | 'espacio' | 'apostrofe' | 'guion' | 'guion_bajo'
  | 'pipe' | 'ninguno' | 'custom'

export type ValuePosition = 'completo' | 'antes' | 'despues' | 'segmento'

export interface ScanField {
  id?: number
  scan_index: number
  extraction_mode: ExtractionMode
  field_target: FieldTarget
  separator: Separator
  separator_custom: string
  value_position: ValuePosition
  segment_index: number | null
  fixed_length: number | null
  prefix_value: string
  display_label: string
  sequence_order: number
}

export interface PartNumberScanRule {
  id?: number
  pn_id: number
  ssi_pn: string
  bu_id: number
  bu_name: string
  scan_count: number
  requires_match: boolean
  notes: string
  is_active: boolean
  field_count?: number
  scan_fields: ScanField[]
  created_at?: string
  updated_at?: string
}

export interface PartNumberLookup {
  pn_id: number
  ssiPN: string
  volvoProductNumber: string | null
  bu_id: number
  bu_name: string
}
