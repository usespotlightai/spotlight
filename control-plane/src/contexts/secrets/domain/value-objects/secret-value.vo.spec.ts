import { inspect } from 'node:util';
import { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';
import { isSecret } from '@shared-kernel/domain/value-objects/secret';
import { describe, expect, it } from 'vitest';

describe('SecretValue', () => {
  const value = SecretValue.of('lin_api_1');

  it('says its value only when asked outright', () => {
    expect(value.revealed()).toBe('lin_api_1');
  });

  it('never says its value in a log, a string or JSON', () => {
    expect(String(value)).toBe('[secret]');
    expect(JSON.stringify({ value })).toBe('{"value":"[secret]"}');
    expect(inspect({ value })).not.toContain('lin_api_1');
    expect(`${value}`).not.toContain('lin_api_1');
  });

  it('is a secret, so no event can carry it', () => {
    expect(isSecret(value)).toBe(true);
  });

  it('rejects nothing at all, and more than any credential needs', () => {
    expect(() => SecretValue.of('')).toThrow(/must not be empty/);
    expect(() => SecretValue.of('x'.repeat(64 * 1024 + 1))).toThrow(
      /must be at most/,
    );
  });

  it('knows when it fits on one line', () => {
    expect(value.fitsOneLine).toBe(true);
    expect(SecretValue.of('-----BEGIN KEY-----\nabc').fitsOneLine).toBe(false);
  });
});
