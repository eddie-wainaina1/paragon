import apiClient from './client';
import type { Organization } from '@/types';

export const orgsApi = {
  getById: (id: string) => apiClient.get<Organization>(`/organizations/${id}`).then((r) => r.data),

  list: () => apiClient.get<Organization[]>('/organizations').then((r) => r.data),

  create: (data: { name: string; type?: string; admin_email?: string }) =>
    apiClient.post<Organization>('/organizations', data).then((r) => r.data),

  update: (id: string, data: Partial<{ name: string; type: string }>) =>
    apiClient.put<Organization>(`/organizations/${id}`, data).then((r) => r.data),

  remove: (id: string) => apiClient.delete(`/organizations/${id}`),
};
