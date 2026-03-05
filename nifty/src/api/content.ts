import apiClient from './client';
import type { Content, ContentCreate, ContentType, ContentScope, AssessmentQuestion } from '@/types';

export const contentApi = {
  list: (params?: { type?: ContentType; scope?: ContentScope }) =>
    apiClient.get<Content[]>('/content', { params }).then((r) => r.data),

  get: (id: string) => apiClient.get<Content>(`/content/${id}`).then((r) => r.data),

  create: (data: ContentCreate) =>
    apiClient.post<Content>('/content', data).then((r) => r.data),

  update: (id: string, data: Partial<ContentCreate & { locked: boolean }>) =>
    apiClient.put<Content>(`/content/${id}`, data).then((r) => r.data),

  remove: (id: string) => apiClient.delete(`/content/${id}`),

  uploadFile: (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient
      .post<Content>(`/content/${id}/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  getFileUrl: (id: string) => `/api/v1/content/${id}/file`,

  getFileToken: (id: string) =>
    apiClient.get<{ token: string }>(`/content/${id}/file-token`).then((r) => r.data.token),

  getQuestions: (id: string) =>
    apiClient.get<AssessmentQuestion[]>(`/content/${id}/questions`).then((r) => r.data),

  addQuestions: (id: string, questions: Omit<AssessmentQuestion, 'qid'>[]) =>
    apiClient.post<Content>(`/content/${id}/questions`, { questions }).then((r) => r.data),

  deleteQuestion: (id: string, qid: string) =>
    apiClient.delete(`/content/${id}/questions/${qid}`),
};
