import apiClient from './client';
import type { LoginRequest, RegisterOrgRequest, TokenResponse } from '@/types';

export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<TokenResponse>('/auth/login', data).then((r) => r.data),

  registerOrg: (data: RegisterOrgRequest) =>
    apiClient.post<TokenResponse>('/auth/register-org', data).then((r) => r.data),

  impersonate: (userId: string) =>
    apiClient.post<TokenResponse>(`/auth/impersonate/${userId}`).then((r) => r.data),
};
