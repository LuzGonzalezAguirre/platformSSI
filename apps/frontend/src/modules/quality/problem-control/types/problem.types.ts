/**
 * Problem Control TypeScript types
 */

export enum ProblemStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  CLOSED = 'closed',
  REJECTED = 'rejected',
}

export enum ProblemSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum StageCode {
  D1 = 'D1',
  D2 = 'D2',
  D3 = 'D3',
  D4 = 'D4',
  D5 = 'D5',
  D6 = 'D6',
  D7 = 'D7',
  D8 = 'D8',
}

export enum StageStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}

export interface UserBrief {
  id: number;
  username: string;
  full_name: string;
  email: string;
}

export interface Stage {
  id: string;
  stage_code: StageCode;
  stage_name: string;
  status: StageStatus;
  data: Record<string, any>;
  due_date: string | null;
  completed_at: string | null;
  is_overdue: boolean;
  assigned_to: number | null;
  assigned_to_name: string | null;
  completed_by: number | null;  
  override_requested: boolean;
  override_approved: boolean;
  override_reason: string;
  can_edit: boolean;
  requires_override: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProblemListItem {
  id: string;
  problem_number: string | null;
  status: ProblemStatus;
  severity: ProblemSeverity;
  customer_name: string;
  part_number: string;
  description: string;
  created_by: number;
  created_by_name: string;
  assigned_champion: number | null;
  champion_name: string | null;
  created_at: string;
  approved_at: string | null;
  closed_at: string | null;
  days_open: number;
  overdue_stages_count: number;
}

export interface ProblemDetail {
  id: string;
  problem_number: string | null;
  status: ProblemStatus;
  severity: ProblemSeverity;
  customer_name: string;
  part_number: string;
  description: string;
  created_by: number;
  created_by_detail: UserBrief;
  assigned_champion: number | null;
  champion_detail: UserBrief | null;
  assigned_quality: number | null;
  quality_detail: UserBrief | null;
  created_at: string;
  approved_at: string | null;
  closed_at: string | null;
  updated_at: string;
  sla_d3_hours: number;
  sla_d4_days: number;
  sla_d5_days: number;
  sla_d6_days: number;
  sla_d7_days: number;
  days_open: number;
  stages: Stage[];
}

export interface ProblemCreateData {
  customer_name: string;
  part_number?: string;
  description: string;
  severity: ProblemSeverity;
  assigned_champion?: number;
  assigned_quality?: number;
}

export interface ProblemFilters {
  status?: ProblemStatus;
  severity?: ProblemSeverity;
  search?: string;
  created_by?: number;
}

export interface AuditLogEntry {
  id: number;
  action: string;
  entity_type: string;
  changes: Record<string, any>;
  user: number;
  user_name: string;
  ip_address: string | null;
  created_at: string;
}

export interface SLASettings {
  d3_hours: number;
  d4_days: number;
  d5_days: number;
  d6_days: number;
  d7_days: number;
  updated_by: number | null;
  updated_by_name: string | null;
  updated_at: string;
}

export interface StageUpdateData {
  data?: Record<string, any>;
  complete?: boolean;
}

export interface OverrideRequestData {
  reason: string;
}