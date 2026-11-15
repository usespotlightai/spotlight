import { kappaReadingOf } from '@insights/domain/services/agreement-reading';
import { describe, expect, it } from 'vitest';

describe('agreement readings', () => {
  it('reads kappa in Landis and Koch’s bands', () => {
    expect(kappaReadingOf(0.81)).toBe('almost-perfect');
    expect(kappaReadingOf(0.7)).toBe('substantial');
    expect(kappaReadingOf(0.41)).toBe('moderate');
    expect(kappaReadingOf(0.4)).toBe('fair');
    expect(kappaReadingOf(0.2)).toBe('slight');
    expect(kappaReadingOf(0)).toBe('chance');
    expect(kappaReadingOf(-0.2)).toBe('chance');
    expect(kappaReadingOf(null)).toBeNull();
  });
});
