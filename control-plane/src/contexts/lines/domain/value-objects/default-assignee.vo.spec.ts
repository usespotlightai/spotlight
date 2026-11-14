import { InvalidDefaultAssigneeError } from '@lines/domain/exceptions/invalid-default-assignee.error';
import { DefaultAssignee } from '@lines/domain/value-objects/default-assignee.vo';
import { describe, expect, it } from 'vitest';

describe('DefaultAssignee', () => {
  it('keeps the email it names, without surrounding space', () => {
    expect(DefaultAssignee.of('  ada@example.com ').email).toBe(
      'ada@example.com',
    );
  });

  it('refuses an empty email', () => {
    expect(() => DefaultAssignee.of('  ')).toThrow(
      'Default assignee is the email of a team member, and it is empty.',
    );
  });

  it.each([
    'ada',
    'ada@',
    '@example.com',
    'ada@example',
    'ada lovelace@example.com',
  ])('refuses %s', (email) => {
    expect(() => DefaultAssignee.of(email)).toThrow(
      InvalidDefaultAssigneeError,
    );
  });

  it('keeps the case of the email as it is written', () => {
    expect(
      DefaultAssignee.of('Ada@Example.com').equals(
        DefaultAssignee.of('ada@example.com'),
      ),
    ).toBe(false);
    expect(
      DefaultAssignee.of('ada@example.com').equals(
        DefaultAssignee.of('grace@example.com'),
      ),
    ).toBe(false);
  });
});
