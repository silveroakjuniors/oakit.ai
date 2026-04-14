import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
}

const paddingMap = {
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-8',
};

export default function Card({ children, className = '', padding = 'md' }: CardProps) {
  return (
    <div className={`bg-surface rounded-xl shadow-sm border border-gray-100 ${paddingMap[padding]} ${className}`}>
      {children}
    </div>
  );
}
