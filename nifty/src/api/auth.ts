import apiClient from './client';
import type { LoginRequest, RegisterOrgRequest, RegisterIndividualRequest, TokenResponse, ForgotPasswordRequest, ResetPasswordRequest } from '@/types';

export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<TokenResponse>('/auth/login', data).then((r) => r.data),

  registerOrg: (data: RegisterOrgRequest) =>
    apiClient.post<TokenResponse>('/auth/register-org', data).then((r) => r.data),

  registerIndividual: (data: RegisterIndividualRequest) =>
    apiClient.post<TokenResponse>('/auth/register-individual', data).then((r) => r.data),

  impersonate: (userId: string) =>
    apiClient.post<TokenResponse>(`/auth/impersonate/${userId}`).then((r) => r.data),

  forgotPassword: (data: ForgotPasswordRequest) =>
    apiClient.post<{ message: string }>('/auth/forgot-password', data).then((r) => r.data),

  resetPassword: (data: ResetPasswordRequest) =>
    apiClient.post<TokenResponse>('/auth/reset-password', data).then((r) => r.data),
};
