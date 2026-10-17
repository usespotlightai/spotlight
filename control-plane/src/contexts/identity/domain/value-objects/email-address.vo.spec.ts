import { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import { describe, expect, it } from 'vitest';

describe('EmailAddress', () => {
  it('is stored as the mailbox it names, however it was typed', () => {
    expect(EmailAddress.of('  Ada@Example.COM ').value).toBe('ada@example.com');
  });

  it('takes the addresses people actually have', () => {
    for (const written of [
      'ada+spotlight@example.com',
      'ada.lovelace@mail.example.co.uk',
      "o'hara@example.org",
    ]) {
      expect(EmailAddress.of(written).value).toBe(written.toLowerCase());
    }
  });

  it.each([
    ['nothing at all', ''],
    ['no mailbox', '@example.com'],
    ['no host', 'ada@'],
    ['no dot in the host', 'ada@example'],
    ['two addresses', 'ada@example.com, grace@example.com'],
    ['a name around it', 'Ada <ada@example.com>'],
    ['longer than any address is', `${'a'.repeat(250)}@example.com`],
  ])('refuses %s', (_why, written) => {
    expect(() => EmailAddress.of(written)).toThrow(
      /Email address is not valid/,
    );
  });

  it('is the same address as one written differently', () => {
    expect(
      EmailAddress.of('ada@example.com').equals(
        EmailAddress.of('ADA@example.com'),
      ),
    ).toBe(true);
  });
});
