import type { AnchorHTMLAttributes } from 'react';

import { cn } from './cn';

type BottomNavItem = AnchorHTMLAttributes<HTMLAnchorElement> & {
  label: string;
};

type BottomNavProps = {
  items: BottomNavItem[];
};

export function BottomNav({ items }: BottomNavProps) {
  return (
    <nav aria-label="Navegación principal" className="bottom-nav">
      {items.map(({ className, label, ...item }) => (
        <a className={cn('bottom-nav-link', className)} key={label} {...item}>
          {label}
        </a>
      ))}
    </nav>
  );
}
