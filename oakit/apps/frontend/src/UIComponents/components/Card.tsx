import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  onClick?: () => void;
  border?: boolean;
}

const paddingMap = {
  none: '',
  xs:   'p-3',
  sm:   'p-4',
  md:   'p-5',
  lg:   'p-6',
};

export function Card({ children, className = '', padding = 'md', hover = false, onClick, border = true }: CardProps) {
  return (
    <div
      onClick={onClick}
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
      className={`
        bg-white rounded-xl
        ${border ? 'border border-neutral-200' : ''}
        transition-all duration-150
        ${hover || onClick ? 'hover:border-neutral-300 cursor-pointer' : ''}
        ${paddingMap[padding]}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

export default Card;
