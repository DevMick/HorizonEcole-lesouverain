import { forwardRef, useId } from 'react';
import { AlertCircle, Search } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  inputSize?: 'sm' | 'md';
}

/** Champ texte/nombre du design system (§5.2). */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, error, inputSize = 'md', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={error || undefined}
      className={cn('ds-input', inputSize === 'sm' && 'ds-input-sm', error && 'ds-input-error', className)}
      {...rest}
    />
  );
});

export interface FieldProps {
  label?: React.ReactNode;
  htmlFor?: string;
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** Groupe label + champ + message d'erreur (associé via aria-describedby). */
export function Field({ label, htmlFor, error, hint, children, className }: FieldProps) {
  const autoId = useId();
  const id = htmlFor ?? autoId;
  const errorId = `${id}-error`;
  return (
    <div className={cn('ds-field', className)}>
      {label && <label htmlFor={id}>{label}</label>}
      {children}
      {hint && !error && <span className="text-[.74rem] text-ds-text-tertiary">{hint}</span>}
      {error && (
        <span id={errorId} className="ds-field-error" role="alert">
          <AlertCircle aria-hidden width={14} height={14} />
          {error}
        </span>
      )}
    </div>
  );
}

export interface SearchInputProps extends InputProps {
  wrapClassName?: string;
}

/** Recherche en pilule avec icône loupe (§5.2). */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { wrapClassName, className, placeholder = 'Rechercher…', ...rest },
  ref,
) {
  return (
    <div className={cn('ds-input-wrap', wrapClassName)}>
      <Search aria-hidden />
      <Input
        ref={ref}
        type="search"
        placeholder={placeholder}
        className={cn('ds-input-search', className)}
        {...rest}
      />
    </div>
  );
});
