import { twMerge } from 'tailwind-merge';

/** Joins class names and lets later utilities win over earlier ones (docs 11 §5). */
export function cn(...classes: readonly (string | false | null | undefined)[]): string {
  return twMerge(classes.filter(Boolean).join(' '));
}
