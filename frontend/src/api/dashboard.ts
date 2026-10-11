import { api } from './client';
import type { DashboardStats } from '../types';

export const dashboardApi = {
  stats: () => api.get<{ stats: DashboardStats }>('/api/dashboard/stats').then((r) => r.stats),
};
