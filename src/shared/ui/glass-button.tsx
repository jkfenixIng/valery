import type { ButtonHTMLAttributes } from 'react';

import { cn } from './cn';

type GlassButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
};

export function GlassButton({
  children,
  className,
  disabled,
  loading = false,
  variant = 'primary',
  ...props
}: GlassButtonProps) {
  return (
    <button
      aria-busy={loading || undefined}
      className={cn('glass-button', `glass-button-${variant}`, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span aria-hidden className="spinner" /> : null}
      <span>{children}</span>
    </button>
  );
}
