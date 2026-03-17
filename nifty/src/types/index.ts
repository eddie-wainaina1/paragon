export type Role =
  | 'super_admin'
  | 'tutor'
  | 'finance'
  | 'org_admin'
  | 'teacher'
  | 'student';

export type ContentType = 'text' | 'video' | 'audio' | 'pdf' | 'assessment';
export type ContentScope = 'global' | 'org';
export type OrgType = 'platform' | 'school';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  type: OrgType;
  internal: boolean;
  created_at: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  org: string;
  org_name: string;
  avatar: string;
  verified: boolean;
  created_at: string;
  terms_accepted_at: string | null;
  phone?: string | null;
  tutor_application_pending?: boolean;
}

export interface AssessmentQuestion {
  qid: string;
  question: string;
  choices: string[];
  answer: number;
}

export interface AssessmentQuestionForStudent {
  qid: string;
  question: string;
  choices: string[];
}

export interface AssessmentAttemptStart {
  attempt_id: string;
  questions: AssessmentQuestionForStudent[];
  attempts_used: number;
  max_attempts: number | null;
}

export interface AssessmentAttemptResult {
  score: number;
  passed: boolean;
  correct: number;
  total: number;
  attempts_used: number;
  attempts_remaining: number | null;
}

export interface Content {
  id: string;
  title: string;
  type: ContentType;
  scope: ContentScope;
  org: string;
  org_name?: string;
  author: string;
  author_name?: string;
  subject?: string;
  body?: string;
  file_id?: string;
  file_name?: string;
  file_content_type?: string;
  hls_ready?: boolean;
  views: number;
  locked: boolean;
  emoji: string;
  questions_count?: number;
  max_questions?: number | null;
  passing_score?: number | null;
  questions?: AssessmentQuestion[];
  created_at: string;
  updated_at: string;
}

export type ClassScope = 'global' | 'org';

export interface ClassContentItemSimple {
  content_id: string;
  blocking: boolean;
  order: number;
}

export interface ClassContentDetail extends Content {
  content_id: string;
  blocking: boolean;
  order: number;
  completed: boolean;
  accessible: boolean;
  best_score?: number | null;
  attempts_count?: number;
  max_attempts?: number | null;
  attempt_interval_value?: number | null;
  attempt_interval_unit?: string | null;
}

export interface StudentProgressOut {
  student_id: string;
  student_name: string;
  student_avatar: string;
  completed_count: number;
  total_count: number;
  completed_content_ids: string[];
}

export interface ClassProgressOut {
  class_id: string;
  total_content: number;
  students: StudentProgressOut[];
}

export interface Class {
  id: string;
  name: string;
  grade?: string;
  scope: ClassScope;
  teacher: string;
  teacher_name?: string;
  org: string;
  org_name?: string;
  student_count: number;
  content_count: number;
  created_at: string;
  students?: string[];
  content_items?: ClassContentItemSimple[];
}

export type SubscriptionPlan = 'free' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'enterprise_pending';
export type StudentSubKind = 'org_covered' | 'individual';
export type BillingCycle = 'monthly' | 'annual';

export interface OrgSubscription {
  id: string;
  org: string;
  org_name: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  seat_limit: number;   // -1 = unlimited
  seat_used: number;
  billing_cycle: BillingCycle | null;
  current_period_start: string | null;
  current_period_end: string | null;
  paystack_subscription_code: string | null;
  enterprise_note: string | null;
  enterprise_applied_at: string | null;
  managed_by: string | null;
  managed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentSubscription {
  id: string;
  user: string;
  user_name: string;
  user_email: string;
  kind: StudentSubKind;
  plan: 'free' | 'pro';
  status: SubscriptionStatus;
  billing_cycle: BillingCycle | null;
  current_period_start: string | null;
  current_period_end: string | null;
  paystack_subscription_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaystackInitResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterOrgRequest {
  org_name: string;
  admin_first: string;
  admin_last?: string;
  email: string;
  password: string;
}

export interface RegisterIndividualRequest {
  first_name: string;
  last_name?: string;
  email: string;
  password: string;
  apply_as_tutor?: boolean;
  phone?: string;
}

export interface UserCreate {
  name: string;
  email: string;
  password: string;
  role: Role;
  org_id: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

export interface ContentCreate {
  title: string;
  type: ContentType;
  scope: ContentScope;
  subject?: string;
  body?: string;
  emoji?: string;
}

export interface ClassCreate {
  name: string;
  grade?: string;
  scope?: ClassScope;
}

// Constants (ROLE_LABELS, CREATOR_ROLES, ADMIN_ROLES, MANAGER_ROLES, etc.) live in @/constants.
