import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export type SketchAccentColor = 'green' | 'red' | 'blue' | 'yellow';

export const SKETCH_COLORS = {
  bgPage: '#121212',
  bgSurface: '#121212',
  strokePrimary: '#f1f3f5',
  textPrimary: '#f1f3f5',
  textMuted: '#868e96',
  green: '#b2f2bb',
  red: '#ffc9c9',
  blue: '#a5d8ff',
  yellow: '#ffec99',
} as const;
