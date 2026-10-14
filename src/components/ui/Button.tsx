import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  loading?: boolean;
  children?: ReactNode;
}

// Filled buttons carry a darker bottom edge and sink by a pixel when pressed.
const variants: Record<Variant, string> = {
  primary: 'bg-brand-700 text-white shadow-key hover:bg-brand-800 active:translate-y-px active:shadow-none',
  secondary:
    'border border-slate-300 bg-white/80 text-slate-800 shadow-key-light hover:border-slate-400 hover:bg-white active:translate-y-px active:shadow-none',
  ghost: 'text-slate-600 hover:bg-slate-900/[0.07] hover:text-slate-900',
  danger: 'bg-red-600 text-white shadow-key hover:bg-red-700 active:translate-y-px active:shadow-none',
  success: 'bg-emerald-600 text-white shadow-key hover:bg-emerald-700 active:translate-y-px active:shadow-none',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-2.5 text-[13px]',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-11 gap-2 px-5 text-sm',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon: Icon, loading, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        !children && (size === 'sm' ? 'w-8 px-0' : 'w-10 px-0'),
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        Icon && <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden />
      )}
      {children}
    </button>
  );
});
