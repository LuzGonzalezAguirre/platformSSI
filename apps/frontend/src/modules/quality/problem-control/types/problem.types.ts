// apps/frontend/src/features/quality/problem-control/types/problem.types.ts

export type ProblemStatus = 'draft' | 'pending_approval' | 'approved' | 'closed' | 'rejected';

export type ProblemCategory = 
  | '' 
  | '3rd_party_audit' 
  | 'continuous_improvement' 
  | 'customer' 
  | 'delivery' 
  | 'engineering' 
  | 'environmental' 
  | 'internal' 
  | 'internal_audit' 
  | 'preventive' 
  | 'safety' 
  | 'supplier';

export type ProblemType = 
  | 'cost' 
  | 'damaged' 
  | 'delivery' 
  | 'dimensional' 
  | 'documentation' 
  | 'functional' 
  | 'other' 
  | 'packaging' 
  | 'preventive' 
  | 'product_improvement';

export type ShiftType = '' | '1st' | '2nd' | '3rd' | 'weekend' | 'a' | 'b';

export type SeverityContext = 'customer' | 'internal' | 'supplier' | 'audit';

export type AttachmentStep = 'general' | 'step1' | 'step3a' | 'step3b' | 'step5' | 'step6' | 'step7';

export type FiveWhyCategory = 'made' | 'escape' | 'systemic';

// ══════════════════════════════════════════════════════════════════════════
// BASE INTERFACES
// ══════════════════════════════════════════════════════════════════════════

export interface UserBasic {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
}

export interface SeverityLevel {
  id: number;
  level: number;
  customer_note: string;
  internal_note: string;
  supplier_note: string;
  audit_note: string;
}

export interface DefectType {
  id: number;
  code: string;
  description: string;
  is_active: boolean;
}

// ══════════════════════════════════════════════════════════════════════════
// NESTED MODELS
// ══════════════════════════════════════════════════════════════════════════

export interface RootCause {
  id: number;
  root_cause: string;
  order: number;
  is_final: boolean;
  created_at: string;
  created_by: UserBasic;
}

export interface FiveWhyAnalysis {
  id: number;
  category: FiveWhyCategory;
  category_display: string;
  why1: string;
  why2: string;
  why3: string;
  why4: string;
  why5: string;
  corrective_action: string;
  root_causes: RootCause[];
  created_at: string;
  created_by: UserBasic;
}

export interface ContainmentAction {
  id: number;
  problem: number; 
  action: string;
  response?: string;
  responsible?: UserBasic;
  responsible_id?: number;
  add_date?: string; // ISO date
  due_date?: string; // ISO date
  completion_date?: string; // ISO date
  ongoing: boolean;
}

export interface CorrectiveAction {
  id: number;
  root_cause_id: number;
  add_date: string;
  due_date: string;
  completion_date: string | null;
  ongoing: boolean;
  action: string;
  response: string;
  responsible: UserBasic | null;
  responsible_id?: number;
}

export interface VerificationAction {
  id: number;
  add_date: string;
  due_date: string;
  completion_date: string | null;
  ongoing: boolean;
  action: string;
  response: string;
  responsible: UserBasic | null;
  responsible_id?: number;
}

export interface PreventionAction {
  id: number;
  add_date: string;
  due_date: string;
  completion_date: string | null;
  ongoing: boolean;
  action: string;
  response: string;
  responsible: UserBasic | null;
  responsible_id?: number;
}

export interface ProblemAttachment {
  id: number;
  step: AttachmentStep;
  step_display: string;
  file: string;
  filename: string;
  file_size: number;
  uploaded_by: UserBasic;
  uploaded_at: string;
  description: string;
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN PROBLEM INTERFACES
// ══════════════════════════════════════════════════════════════════════════

export interface ProblemListItem {
  id: number;
  problem_number: string | null;
  status: ProblemStatus;
  status_display: string;
  brief_description: string;
  category: ProblemCategory;
  category_display: string;
  part_no: string;
  customer_no: string;
  customer_name: string;
  supplier_no: string;
  department_code: string;
  champion: UserBasic;
  severity_level_value: number;
  building: string;
  created_at: string;
  target_close_date: string | null;
  recurrence_count: number;
  is_overdue: boolean;
}

export interface Problem {
  id: number;
  problem_number: string | null;
  status: ProblemStatus;
  status_display: string;
  
  // Customer Info
  customer_no: string;
  customer_name: string;
  customer_location: string;
  customer_part_no: string;
  customer_problem_no: string;
  customer_contact_name: string;
  customer_contact_fax: string;
  customer_contact_phone: string;
  customer_contact_email: string;
  
  // Supplier Info
  supplier_no: string;
  supplier_name: string;
  supplier_user_name: string;
  supplier_email: string;
  supplier_phone: string;
  
  // Step 1 - Define Problem
  brief_description: string;
  full_description: string;
  category: ProblemCategory;
  category_display: string;
  problem_type: ProblemType;
  problem_type_display: string;
  severity_level_data: SeverityLevel;
  severity_context: SeverityContext;
  
  // Internal Part Info
  part_no: string;
  part_name: string;
  department_code: string;
  department_name: string;
  workcenter_code: string;
  workcenter_name: string;
  shift: ShiftType;
  shift_display: string;
  defect_type_data: DefectType | null;
  quantity_placed_on_hold: number;
  quantity_rejected: number;
  building: string;
  
  // Step 2 - Team
  champion: UserBasic;
  team_members: UserBasic[];
  team_note: string;
  
  // Step 3a - Initial Response
  initial_response_due: string | null;
  initial_response_date: string | null;
  initial_response: string;
  tracking_lot_batch_no: string;
  tracking_build_ship_date: string | null;
  d3_completed_at: string | null;
  
  d3_initial_response?: string;
  d3_tracking_info?: string;
  d3_completed_date?: string; // ISO date string (YYYY-MM-DD)
  // Step 3b - Containment
  d4_completed_at: string | null;
  
  // Step 4 - Five Why
  d5_completed_at: string | null;
  
  // Step 4 - Root Cause
  d6_completed_at: string | null;
  
  // Step 5 - Corrective Actions
  d7_completed_at: string | null;
  
  // Step 6 - Verification
  d8_completed_at: string | null;
  
  // FMEA & Control Plan
  fmea_responsible: UserBasic | null;
  fmea_update_required: boolean;
  fmea_due: string | null;
  fmea_completed: string | null;
  fmea_re_eval: string | null;
  
  control_plan_responsible: UserBasic | null;
  control_plan_update_required: boolean;
  control_plan_due: string | null;
  control_plan_completed: string | null;
  control_plan_re_eval: string | null;
  
  // SLA Snapshots
  sla_d3_hours: number;
  sla_d4_days: number;
  sla_d5_days: number;
  sla_d6_days: number;
  sla_d7_days: number;
  sla_d8_days: number;
  
  // Approval
  approved_by: UserBasic | null;
  approved_at: string | null;
  approval_comments: string;
  
  // Override
  override_requested: boolean;
  override_approved_by: UserBasic | null;
  override_approved_at: string | null;
  override_reason: string;
  
  // Timestamps
  created_by: UserBasic;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  date_of_occurrence: string;
  customer_issue_date: string | null;
  target_close_date: string | null;
  actual_close_date: string | null;
  
  // Metadata
  recurrence_count: number;
  
  // Overdue flags
  is_d3_overdue: boolean;
  is_d4_overdue: boolean;
  is_d5_overdue: boolean;
  is_d6_overdue: boolean;
  is_d7_overdue: boolean;
  is_d8_overdue: boolean;
  is_globally_overdue: boolean;
  
  // Nested relations
  five_why_analyses: FiveWhyAnalysis[];
  containment_actions: ContainmentAction[];
  corrective_actions: CorrectiveAction[];
  verification_actions: VerificationAction[];
  prevention_actions: PreventionAction[];
  attachments: ProblemAttachment[];
}

// ══════════════════════════════════════════════════════════════════════════
// API REQUEST/RESPONSE TYPES
// ══════════════════════════════════════════════════════════════════════════

export interface ProblemCreateRequest {
  brief_description: string;
  full_description: string;
  category: ProblemCategory;
  problem_type: ProblemType;
  severity_level_id: number;
  severity_context: SeverityContext;
  champion_id: number;
  date_of_occurrence: string;
  part_no?: string;
  defect_type_id?: number;
  customer_no?: string;
  supplier_no?: string;

   // Step 2 fields
  team_member_ids?: number[]; 
}

export interface ProblemUpdateRequest {
  [key: string]: any;
}

export interface ProblemFilters {
  status?: ProblemStatus;
  customer_no?: string;
  category?: ProblemCategory;
  severity_level?: number;
  champion_id?: number;
  start_date?: string;
  end_date?: string;
  overdue?: boolean;
}

export interface ApproveRequest {
  comments?: string;
}

export interface RejectRequest {
  comments: string;
}

export interface OverrideRequest {
  reason: string;
}

// ══════════════════════════════════════════════════════════════════════════
// PLEX LOOKUP TYPES
// ══════════════════════════════════════════════════════════════════════════

export interface PlexCustomer {
  no: string;
  name: string;
}

export interface PlexSupplier {
  no: string;
  name: string;
}

export interface PlexPart {
  part_no: string;
  name: string;
}

export interface PlexDepartment {
  code: string;
  name: string;
}

export interface PlexWorkcenter {
  code: string;
  name: string;
}
