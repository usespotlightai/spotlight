import { describe, expect, it } from 'vitest';
import {
  createdTold,
  expiryAfter,
  expiryTold,
  scopesOf,
  scopesTold,
} from '@/lib/token';

const NOW = new Date('2026-09-30T12:00:00.000Z').getTime();

describe('scopesOf', () => {
  it('is the reach alone when nothing more is granted', () => {
    expect(scopesOf('configure', new Set())).toEqual(['configure']);
  });

  it('puts what is granted beside the reach, in one order however it was chosen', () => {
    expect(scopesOf('read', new Set(['trusts', 'secrets'] as const))).toEqual([
      'read',
      'secrets',
      'trusts',
    ]);
  });
});

describe('scopesTold', () => {
  it('names the scopes from least to most, whatever order they came in', () => {
    expect(scopesTold(['trusts', 'configure', 'secrets'])).toBe(
      'Configure, Secrets, Token trusts',
    );
  });
});

describe('expiryAfter', () => {
  it('is that many days from now', () => {
    expect(expiryAfter('30', NOW)).toBe('2026-10-30T12:00:00.000Z');
  });

  it('is never when no lifetime is chosen', () => {
    expect(expiryAfter(null, NOW)).toBeNull();
  });
});

describe('expiryTold', () => {
  it('says a token without an expiry never expires', () => {
    expect(expiryTold(null, NOW)).toBe('No expiry');
  });

  it('says a token past its expiry has expired', () => {
    expect(expiryTold('2026-09-30T11:59:59.000Z', NOW)).toBe('Expired');
  });

  it('names the day a token expires, with its year', () => {
    expect(expiryTold('2027-01-15T12:00:00.000Z', NOW)).toMatch(
      /^Expires .*15.*2027/,
    );
  });
});

describe('createdTold', () => {
  it('names the day a token was made, with its year only when that is not this year', () => {
    expect(createdTold('2026-10-04T12:00:00.000Z', NOW)).toMatch(
      /^Created \D*4\D*$/,
    );
    expect(createdTold('2025-10-04T12:00:00.000Z', NOW)).toMatch(/2025/);
  });
});
