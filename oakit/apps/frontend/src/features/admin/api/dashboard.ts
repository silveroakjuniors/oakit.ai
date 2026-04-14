import { apiGet, apiPost } from '@/lib/api';
import {
  CoverageRow,
  DashStats,
  DrillDown,
  EngagementData,
  SetupStatus,
  SmartAlertsData,
  SafetyAlert,
  TimeMachine,
  TodaySnap,
  TrendRow,
} from '../types';

export async function fetchDashboardStats(token: string) {
  return apiGet<DashStats>('/api/v1/admin/users/dashboard-stats', token);
}

export async function fetchCoverage(token: string) {
  return apiGet<CoverageRow[]>('/api/v1/admin/dashboard/coverage', token);
}

export async function fetchAttendanceTrend(token: string) {
  return apiGet<TrendRow[]>('/api/v1/admin/dashboard/attendance-trend', token);
}

export async function fetchSetupStatus(token: string) {
  return apiGet<SetupStatus>('/api/v1/admin/setup/status', token);
}

export async function fetchTimeMachine(token: string) {
  return apiGet<TimeMachine>('/api/v1/admin/time-machine', token);
}

export async function fetchSafetyAlerts(token: string) {
  return apiGet<{ alerts: SafetyAlert[]; unread_count: number }>('/api/v1/admin/audit/safety-alerts', token);
}

export async function fetchSmartAlerts(token: string) {
  return apiGet<SmartAlertsData>('/api/v1/admin/smart-alerts', token);
}

export async function fetchEngagement(token: string) {
  return apiGet<EngagementData>('/api/v1/admin/dashboard/engagement', token);
}

export async function fetchTodaySnapshot(token: string) {
  return apiGet<TodaySnap>('/api/v1/admin/dashboard/today', token);
}

export async function fetchDrillDown(sectionId: string, token: string) {
  return apiGet<DrillDown>(`/api/v1/admin/dashboard/coverage/${sectionId}`, token);
}

export async function dismissSafetyAlert(id: string, token: string) {
  return apiPost(`/api/v1/admin/audit/safety-alerts/${id}/dismiss`, {}, token);
}

export async function dismissAllSafetyAlerts(token: string) {
  return apiPost('/api/v1/admin/audit/safety-alerts/dismiss-all', {}, token);
}

export async function activateTimeMachine(date: string, ttl_hours: number, token: string) {
  return apiPost<TimeMachine>('/api/v1/admin/time-machine', { date, ttl_hours }, token);
}

export async function deactivateTimeMachine(token: string) {
  return apiPost<TimeMachine>('/api/v1/admin/time-machine/deactivate', {}, token);
}
