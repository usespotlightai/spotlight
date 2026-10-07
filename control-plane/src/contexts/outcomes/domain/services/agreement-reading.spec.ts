import {
  correlationReadingOf,
  kappaReadingOf,
} from '@outcomes/domain/services/agreement-reading';
import { describe, expect, it } from 'vitest';

describe('agreement readings', () => {
  it('reads kappa in Landis and Koch’s bands', () => {
    expect(kappaReadingOf(0.81)).toBe('almost-perfect');
    expect(kappaReadingOf(0.7)).toBe('substantial');
    expect(kappaReadingOf(0.41)).toBe('moderate');
    expect(kappaReadingOf(0.4)).toBe('fair-to-slight');
    expect(kappaReadingOf(0)).toBe('fair-to-slight');
    expect(kappaReadingOf(-0.2)).toBe('poor');
    expect(kappaReadingOf(null)).toBeNull();
  });

  it('reads a correlation from very strong down to inverse', () => {
    expect(correlationReadingOf(0.95)).toBe('very-strong');
    expect(correlationReadingOf(0.7)).toBe('strong');
    expect(correlationReadingOf(0.5)).toBe('moderate');
    expect(correlationReadingOf(0.49)).toBe('weak');
    expect(correlationReadingOf(0)).toBe('weak');
    expect(correlationReadingOf(-0.95)).toBe('inverse');
    expect(correlationReadingOf(null)).toBeNull();
  });
});
