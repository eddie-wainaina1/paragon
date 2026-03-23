import apiClient from './client';
import type {
  OrgSubscription,
  StudentSubscription,
  PaystackInitResponse,
} from '@/types';

export const subscriptionsApi = {
  // ── Org subscriptions ────────────────────────────────────────────────────

  listOrgs: () =>
    apiClient.get<OrgSubscription[]>('/subscriptions/orgs').then((r) => r.data),

  getOrg: (orgId: string) =>
    apiClient.get<OrgSubscription>(`/subscriptions/orgs/${orgId}`).then((r) => r.data),

  upgradeOrg: (orgId: string, data: { billing_cycle: string; callback_url: string }) =>
    apiClient
      .post<PaystackInitResponse>(`/subscriptions/orgs/${orgId}/upgrade`, data)
      .then((r) => r.data),

  verifyOrgUpgrade: (orgId: string, reference: string) =>
    apiClient
      .post<OrgSubscription>(`/subscriptions/orgs/${orgId}/verify`, null, {
        params: { reference },
      })
      .then((r) => r.data),

  applyEnterprise: (orgId: string, data: { note?: string }) =>
    apiClient
      .post<OrgSubscription>(`/subscriptions/orgs/${orgId}/apply-enterprise`, data)
      .then((r) => r.data),

  approveEnterprise: (orgId: string, data: { validity_days: number; note?: string }) =>
    apiClient
      .post<OrgSubscription>(`/subscriptions/orgs/${orgId}/approve-enterprise`, data)
      .then((r) => r.data),

  cancelOrg: (orgId: string) =>
    apiClient
      .post<OrgSubscription>(`/subscriptions/orgs/${orgId}/cancel`)
      .then((r) => r.data),

  updateOrg: (
    orgId: string,
    data: Partial<{
      plan: string;
      status: string;
      seat_limit: number;
      billing_cycle: string;
      current_period_start: string;
      current_period_end: string;
      note: string;
    }>
  ) =>
    apiClient
      .put<OrgSubscription>(`/subscriptions/orgs/${orgId}`, data)
      .then((r) => r.data),

  // ── Student subscriptions ────────────────────────────────────────────────

  listStudents: () =>
    apiClient.get<StudentSubscription[]>('/subscriptions/students').then((r) => r.data),

  getStudent: (userId: string) =>
    apiClient
      .get<StudentSubscription>(`/subscriptions/students/${userId}`)
      .then((r) => r.data),

  getMySubscription: () =>
    apiClient
      .get<StudentSubscription>('/subscriptions/students/me')
      .then((r) => r.data),

  upgradeStudent: (data: { billing_cycle: string; callback_url: string }) =>
    apiClient
      .post<PaystackInitResponse>('/subscriptions/students/me/upgrade', data)
      .then((r) => r.data),

  verifyStudentUpgrade: (reference: string) =>
    apiClient
      .post<StudentSubscription>('/subscriptions/students/me/verify', null, {
        params: { reference },
      })
      .then((r) => r.data),

  cancelStudentSubscription: () =>
    apiClient
      .post<StudentSubscription>('/subscriptions/students/me/cancel')
      .then((r) => r.data),

  updateStudent: (
    userId: string,
    data: Partial<{
      plan: string;
      status: string;
      billing_cycle: string;
      current_period_start: string;
      current_period_end: string;
    }>
  ) =>
    apiClient
      .put<StudentSubscription>(`/subscriptions/students/${userId}`, data)
      .then((r) => r.data),
};
