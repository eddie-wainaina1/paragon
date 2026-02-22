export type Role =
  | 'super_admin'
  | 'tutor'
  | 'finance'
  | 'org_admin'
  | 'teacher'
  | 'student';

export type ContentType = 'text' | 'video' | 'audio';
export type ContentScope = 'global' | 'org';
export type OrgType = 'platform' | 'school';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  type: OrgType;
  created_at: string;
  admin_temp_password?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  org: string;
  org_name: string;
  avatar: string;
  created_at: string;
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
  views: number;
  locked: boolean;
  emoji: string;
  created_at: string;
  updated_at: string;
}

export interface Class {
  id: string;
  name: string;
  grade?: string;
  teacher: string;
  teacher_name?: string;
  org: string;
  org_name?: string;
  student_count: number;
  unlocked_content_count: number;
  created_at: string;
  students?: string[];
  unlocked_content?: string[];
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

export interface UserCreate {
  name: string;
  email: string;
  password: string;
  role: Role;
  org_id: string;
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
}

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  tutor: 'Tutor',
  finance: 'Finance',
  org_admin: 'Org Admin',
  teacher: 'Teacher',
  student: 'Student',
};

export const CREATOR_ROLES: Role[] = ['super_admin', 'tutor', 'org_admin', 'teacher'];
export const ADMIN_ROLES: Role[] = ['super_admin', 'org_admin'];
export const MANAGER_ROLES: Role[] = ['super_admin', 'org_admin', 'teacher'];
