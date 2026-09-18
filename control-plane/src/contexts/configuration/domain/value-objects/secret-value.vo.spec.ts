import { SecretValue } from '@configuration/domain/value-objects/secret-value.vo';
import { describe, expect, it } from 'vitest';

describe('SecretValue', () => {
  it('holds the value it was given, whitespace and all', () => {
    expect(SecretValue.maybe(' xoxb-fake\n')?.value).toBe(' xoxb-fake\n');
  });

  it('is nothing where the value is wholly blank', () => {
    expect(SecretValue.maybe('')).toBeNull();
    expect(SecretValue.maybe(' \n\t')).toBeNull();
  });

  it('never says the value where it is printed or serialised', () => {
    const value = SecretValue.maybe('xoxb-fake') as SecretValue;

    expect(String(value)).toBe('[secret]');
    expect(`${value}`).not.toContain('xoxb-fake');
    expect(JSON.stringify({ value })).toBe('{"value":"[secret]"}');
  });
});
