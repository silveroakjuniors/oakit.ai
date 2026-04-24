import { apiGet, apiPost, apiDelete } from '@/lib/api';
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
export async function fetchTodaySections(token: string) {
  return apiGet<{ sections: TodaySectionRow[]; date: string }>('/api/v1/admin/dashboard/today-sections', token);
}
export async function fetchAdminBirthdays(token: string, days = 7) {
  return apiGet<BirthdayRow[]>(`/api/v1/admin/dashboard/birthdays?days=${days}`, token);
}
export async function generateBirthdayWish(students: { name: string; age?: number; class_name: string; section_label: string }[], token: string) {
  return apiPost<{ message: string }>('/api/v1/admin/dashboard/birthday-wish', { students }, token);
}
export async function sendBirthdayWish(student_ids: string[], message: string, token: string) {
  return apiPost<{ sent_to: string[]; count: number }>('/api/v1/admin/dashboard/birthday-send', { student_ids, message }, token);
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
  await apiDelete('/api/v1/admin/time-machine', token);
  return { active: false, mock_date: null, expires_at: null, ttl_seconds: 0 } as TimeMachine;
}

export interface TodaySectionRow {
  section_id: string;
  section_label: string;
  class_name: string;
  teacher_name: string | null;
  total_students: number;
  present: number;
  absent: number;
  attendance_submitted: boolean;
  plan_completed: boolean;
}

export interface BirthdayRow {
  student_id: string;
  name: string;
  class_name: string;
  section_label: string;
  days_until: number;
  birth_day: number;
  birth_month: number;
  current_age: number;
  turning_age: number;
  date_of_birth: string;
}
