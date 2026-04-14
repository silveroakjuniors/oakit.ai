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
  lg:   'p-7',
};

export function Card({ children, className = '', padding = 'md', hover = false, onClick, border = true }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-2xl
        ${border ? 'border border-neutral-100' : ''}
        shadow-sm
        transition-all duration-200
        ${hover || onClick ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer' : ''}
        ${paddingMap[padding]}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

export default Card;
