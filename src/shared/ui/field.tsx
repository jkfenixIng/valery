import type { InputHTMLAttributes } from 'react';

import { cn } from './cn';

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
  label: string;
};

export function Field({ className, error, id, label, ...props }: FieldProps) {
  const inputId = id ?? label.toLowerCase().replaceAll(/\s+/g, '-');
  const errorId = `${inputId}-error`;

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error) || undefined}
        className={cn('field-input', error && 'field-input-error', className)}
        id={inputId}
        {...props}
      />
      {error ? (
        <span className="field-error" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}
