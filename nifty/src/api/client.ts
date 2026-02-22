import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
apiClient.interceptors.request.use((config) => {
  const raw = localStorage.getItem('nifty-auth');
  if (raw) {
    try {
      // Zustand persist wraps state as { state: { user, token }, version: 0 }
      const { token } = (JSON.parse(raw) as { state?: { token?: string } }).state ?? {};
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // ignore malformed storage
    }
  }
  return config;
});

// On 401, clear auth and redirect to landing
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('nifty-auth');
      window.location.href = '/';
    }
    return Promise.reject(err);
  },
);

export default apiClient;
