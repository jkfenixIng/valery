import { twMerge } from 'tailwind-merge';

type ClassValue = string | false | null | undefined | ClassValue[];

export function cn(...values: ClassValue[]) {
  const classes: string[] = [];
  const collect = (value: ClassValue): void => {
    if (typeof value === 'string') {
      classes.push(value);
    }

    if (Array.isArray(value)) {
      value.forEach(collect);
    }
  };

  values.forEach(collect);
  return twMerge(classes.join(' '));
}
