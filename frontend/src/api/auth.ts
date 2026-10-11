import { api } from './client';
import type { User } from '../types';

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ user: User }>('/api/auth/login', { email, password }).then((r) => r.user),

  logout: () => api.post<{ success: boolean }>('/api/auth/logout'),

  me: () => api.get<{ user: User }>('/api/auth/me').then((r) => r.user),
};
