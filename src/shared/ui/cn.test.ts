import { describe, expect, it } from 'vitest';

import { cn } from './cn';

describe('cn', () => {
  it('merges conditional classes and resolves Tailwind conflicts in favour of the last value', () => {
    expect(cn('px-2 text-sm', false, ['px-4', null], 'text-base')).toBe(
      'px-4 text-base',
    );
  });
});
