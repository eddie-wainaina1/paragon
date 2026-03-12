import apiClient from './client';
import type { User, UserCreate } from '@/types';

export const usersApi = {
  getMe: () => apiClient.get<User>('/users/me').then((r) => r.data),

  updateMe: (data: Partial<{ name: string; email: string; password: string }>) =>
    apiClient.put<User>('/users/me', data).then((r) => r.data),

  getById: (id: string) => apiClient.get<User>(`/users/${id}`).then((r) => r.data),

  list: () => apiClient.get<User[]>('/users').then((r) => r.data),

  create: (data: UserCreate) =>
    apiClient.post<User>('/users', data).then((r) => r.data),

  update: (id: string, data: Partial<UserCreate>) =>
    apiClient.put<User>(`/users/${id}`, data).then((r) => r.data),

  remove: (id: string) => apiClient.delete(`/users/${id}`),

  acceptTerms: () =>
    apiClient.post<User>('/users/me/accept-terms', { accept: true }).then((r) => r.data),
};
