/**
 * Oakit UI Component Library
 *
 * Import from here for all UI needs:
 *   import { Button, Card, Alert, CollapsiblePanel } from '@/UIComponents';
 *
 * Structure:
 *   tokens/      — design tokens (colors, spacing, typography, animation)
 *   primitives/  — atoms: Button, Badge, Input, Toggle, Spinner, Avatar
 *   components/  — molecules: Card, Modal, Alert, CollapsiblePanel, Tabs, ProgressBar
 *   patterns/    — organisms: PageHeader, EmptyState, StatCard
 *   feedback/    — Toast, Skeleton, SkeletonCard
 */

// Tokens
export * from './tokens';

// Primitives
export { Button } from './primitives/Button';
export type { ButtonVariant, ButtonSize } from './primitives/Button';
export { Badge } from './primitives/Badge';
export type { BadgeVariant, BadgeSize } from './primitives/Badge';
export { Input } from './primitives/Input';
export { Toggle } from './primitives/Toggle';
export { Spinner } from './primitives/Spinner';
export { Avatar } from './primitives/Avatar';

// Components
export { Card } from './components/Card';
export { CollapsiblePanel } from './components/CollapsiblePanel';
export { Alert } from './components/Alert';
export type { AlertVariant } from './components/Alert';
export { Tabs } from './components/Tabs';
export type { Tab } from './components/Tabs';
export { Modal } from './components/Modal';
export { ProgressBar } from './components/ProgressBar';

// Patterns
export { EmptyState } from './patterns/EmptyState';
export { PageHeader } from './patterns/PageHeader';
export { StatCard } from './patterns/StatCard';

// Feedback
export { Skeleton, SkeletonCard } from './feedback/Skeleton';
export { Toast } from './feedback/Toast';
export type { ToastVariant } from './feedback/Toast';

// Teacher-specific components
export { OakieMessage, OakieMessageText } from './teacher/OakieMessage';
export { RawPlanModal } from './teacher/RawPlanModal';
export { TopicsChecklist } from './teacher/TopicsChecklist';
