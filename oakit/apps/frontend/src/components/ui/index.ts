/**
 * Legacy re-export shim.
 * All new code should import from '@/UIComponents' directly.
 * This file keeps existing page imports working without changes.
 *
 * Components that have been promoted to UIComponents re-export from there.
 * Components unique to this folder (AcademicYearSelect, ProgressRing, etc.)
 * remain here until migrated.
 */

// Promoted to UIComponents — re-export for backward compatibility
export { Button } from '@/UIComponents';
export { Card } from '@/UIComponents';
export { Badge } from '@/UIComponents';
export { Input } from '@/UIComponents';
export { ProgressBar } from '@/UIComponents';
export { EmptyState } from '@/UIComponents';
export { StatCard } from '@/UIComponents';

// Still local — not yet in UIComponents
export { default as AcademicYearSelect } from './AcademicYearSelect';
export { default as SkeletonLoader } from './SkeletonLoader';
export { default as ProgressRing } from './ProgressRing';
export { default as BottomNav } from './BottomNav';
