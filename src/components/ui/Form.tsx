import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FieldShell {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
}

function Shell({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: FieldShell & { id: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-slate-700">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldShell {
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, wrapperClassName, className, id, required, ...rest },
  ref,
) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <Shell id={fieldId} label={label} hint={hint} error={error} required={required} className={wrapperClassName}>
      <input
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={!!error}
        className={cn('field-input', error && 'border-red-400 focus:border-red-500 focus:ring-red-500/20', className)}
        {...rest}
      />
    </Shell>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, FieldShell {
  wrapperClassName?: string;
  options: Array<string | { value: string; label: string }>;
  placeholder?: string;
}

export function Select({
  label,
  hint,
  error,
  wrapperClassName,
  className,
  id,
  options,
  placeholder,
  required,
  ...rest
}: SelectProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <Shell id={fieldId} label={label} hint={hint} error={error} required={required} className={wrapperClassName}>
      <div className="relative">
        <select
          id={fieldId}
          required={required}
          className={cn('field-input appearance-none pr-9', className)}
          {...rest}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => {
            const opt = typeof o === 'string' ? { value: o, label: o } : o;
            return (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            );
          })}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
      </div>
    </Shell>
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldShell {
  wrapperClassName?: string;
}

export function Textarea({ label, hint, error, wrapperClassName, className, id, required, ...rest }: TextareaProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <Shell id={fieldId} label={label} hint={hint} error={error} required={required} className={wrapperClassName}>
      <textarea
        id={fieldId}
        required={required}
        rows={3}
        className={cn('field-input h-auto py-2 leading-relaxed', className)}
        {...rest}
      />
    </Shell>
  );
}

/** Native date input with the shared field styling. Value is YYYY-MM-DD. */
export function DatePicker(props: Omit<InputProps, 'type'>) {
  return <Input type="date" {...props} />;
}

export function Checkbox({
  label,
  description,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; description?: string }) {
  const id = useId();
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-700 accent-brand-700"
        {...rest}
      />
      <label htmlFor={id} className="text-sm text-slate-700">
        {label}
        {description && <span className="block text-xs text-slate-500">{description}</span>}
      </label>
    </div>
  );
}

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  size?: 'md' | 'lg';
  autoFocus?: boolean;
  'aria-label'?: string;
}

export function SearchBar({ value, onChange, placeholder = 'Search…', className, size = 'md', autoFocus, ...rest }: SearchBarProps) {
  return (
    <div className={cn('relative', className)}>
      <Search
        className={cn(
          'pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400',
          size === 'lg' ? 'left-4 h-5 w-5' : 'left-3 h-4 w-4',
        )}
        aria-hidden
      />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={rest['aria-label'] ?? placeholder}
        className={cn(
          'field-input [&::-webkit-search-cancel-button]:hidden',
          size === 'lg' ? 'h-14 rounded-xl pl-12 pr-11 text-base' : 'pl-9 pr-8',
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className={cn(
            'absolute top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700',
            size === 'lg' ? 'right-3' : 'right-1.5',
          )}
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
