import { apiGet, apiPost, apiDelete, apiPatch } from '@/lib/api';
import {
  AdminClass,
  AdminStudent,
  AdminProgressReport,
  AdminSchoolReport,
  AdminQuizRow,
  AdminQuizResult,
  AdminStudentReport,
  AdminSavedReport,
} from '../types';

export async function fetchAdminClasses(token: string) {
  return apiGet<AdminClass[]>('/api/v1/admin/classes', token);
}

export async function fetchAdminStudents(sectionId: string, token: string) {
  return apiGet<AdminStudent[]>(`/api/v1/admin/students?section_id=${sectionId}`, token);
}

export async function fetchProgressReport(studentId: string, from: string, to: string, token: string, reportType: 'progress' | 'term' | 'annual' = 'progress') {
  return apiGet<AdminProgressReport>(`/api/v1/admin/reports/progress-report?student_id=${studentId}&from=${from}&to=${to}${reportType === 'progress' ? '' : `&report_type=${reportType}`}`, token);
}

export async function fetchSavedReports(studentId: string | undefined, sectionId: string | undefined, token: string) {
  const query = studentId ? `?student_id=${studentId}` : sectionId ? `?section_id=${sectionId}` : '';
  return apiGet<AdminSavedReport[]>(`/api/v1/admin/reports/saved${query}`, token);
}

export async function fetchSavedReportById(reportId: string, token: string) {
  return apiGet<AdminProgressReport>(`/api/v1/admin/reports/saved/${reportId}`, token);
}

export async function updateSavedReport(reportId: string, ai_report: string, token: string) {
  return apiPatch<{ message: string }>(`/api/v1/admin/reports/saved/${reportId}`, { ai_report }, token);
}

export async function shareSavedReport(reportId: string, token: string) {
  return apiPost<{ message: string }>(`/api/v1/admin/reports/saved/${reportId}/share`, {}, token);
}

export async function deleteSavedReport(reportId: string, token: string) {
  return apiDelete(`/api/v1/admin/reports/saved/${reportId}`, token);
}

export async function fetchQuizzes(token: string) {
  return apiGet<AdminQuizRow[]>('/api/v1/admin/quizzes', token);
}

export async function fetchQuizResults(quizId: string, token: string) {
  return apiGet<AdminQuizResult[]>(`/api/v1/admin/quizzes/${quizId}/results`, token);
}

export async function fetchStudentReport(studentId: string, token: string) {
  return apiGet<AdminStudentReport>(`/api/v1/admin/reports/student/${studentId}`, token);
}

export async function fetchSchoolReport(token: string) {
  return apiGet<AdminSchoolReport>('/api/v1/admin/reports/school', token);
}
