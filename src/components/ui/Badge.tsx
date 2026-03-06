import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'bg-primary-100 text-primary-800 border-transparent',
    secondary: 'bg-gray-100 text-gray-800 border-transparent',
    destructive: 'bg-red-100 text-red-800 border-transparent',
    outline: 'border-gray-300 text-gray-700',
    success: 'bg-green-100 text-green-800 border-transparent',
    warning: 'bg-yellow-100 text-yellow-800 border-transparent',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
