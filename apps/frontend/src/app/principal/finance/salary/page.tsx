// Principal salary page — re-exports the admin salary page.
// Principal bypasses the salary PIN guard on the backend (salaryPinGuard
// skips PIN verification for the 'principal' role).
export { default } from '@/app/admin/finance/salary/page';
