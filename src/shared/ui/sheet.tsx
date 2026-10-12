import type { ReactNode } from 'react';

import { cn } from './cn';

type SheetProps = {
  children: ReactNode;
  className?: string;
  open: boolean;
  title: string;
};

export function Sheet({ children, className, open, title }: SheetProps) {
  if (!open) {
    return null;
  }

  return (
    <section aria-label={title} className={cn('sheet', className)}>
      <div className="sheet-handle" />
      <h2 className="sheet-title">{title}</h2>
      {children}
    </section>
  );
}
