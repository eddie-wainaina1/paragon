import apiClient from './client';
import type { Class, ClassCreate } from '@/types';

export const classesApi = {
  list: () => apiClient.get<Class[]>('/classes').then((r) => r.data),

  get: (id: string) => apiClient.get<Class>(`/classes/${id}`).then((r) => r.data),

  create: (data: ClassCreate) =>
    apiClient.post<Class>('/classes', data).then((r) => r.data),

  update: (id: string, data: Partial<ClassCreate>) =>
    apiClient.put<Class>(`/classes/${id}`, data).then((r) => r.data),

  remove: (id: string) => apiClient.delete(`/classes/${id}`),

  addStudent: (classId: string, userId: string) =>
    apiClient
      .post<Class>(`/classes/${classId}/students`, { user_id: userId })
      .then((r) => r.data),

  removeStudent: (classId: string, userId: string) =>
    apiClient
      .delete<Class>(`/classes/${classId}/students/${userId}`)
      .then((r) => r.data),
};
