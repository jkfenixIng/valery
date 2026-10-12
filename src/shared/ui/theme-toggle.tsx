'use client';

import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';

import { cn } from './cn';

export function ThemeToggle() {
  const { resolvedTheme, setTheme, theme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  if (!mounted) {
    return <span aria-hidden className="h-11 w-28" />;
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <div
      aria-label="Tema"
      className="flex rounded-full border border-[var(--border)] p-1"
    >
      <button
        aria-label="Usar tema claro"
        aria-pressed={theme === 'light'}
        className={cn(
          'theme-choice',
          theme === 'light' && 'theme-choice-active',
        )}
        onClick={() => setTheme('light')}
        type="button"
      >
        Claro
      </button>
      <button
        aria-label="Usar tema oscuro"
        aria-pressed={theme === 'dark'}
        className={cn(
          'theme-choice',
          theme === 'dark' && 'theme-choice-active',
        )}
        onClick={() => setTheme('dark')}
        type="button"
      >
        Oscuro
      </button>
      <button
        aria-label="Usar tema del sistema"
        aria-pressed={theme === 'system'}
        className={cn(
          'theme-choice',
          theme === 'system' && 'theme-choice-active',
        )}
        onClick={() => setTheme('system')}
        type="button"
      >
        {isDark ? 'Sistema · oscuro' : 'Sistema · claro'}
      </button>
    </div>
  );
}
