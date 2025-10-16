import * as React from 'react';


type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
  destructive: 'bg-red-600 text-white hover:bg-red-700',
  outline: 'border border-gray-300 text-gray-800',
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={[
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
          variantClasses[variant],
          className
        ].filter(Boolean).join(' ') }
        {...props}
      />
    );
  }
);
Badge.displayName = 'Badge';

export default Badge;

