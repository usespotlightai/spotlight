import { InvalidEmailAddressError } from '@identity/domain/exceptions/invalid-email-address.error';
import { InviteeCountError } from '@identity/domain/exceptions/invitee-count.error';
import {
  Invitees,
  MOST_INVITED_AT_ONCE,
} from '@identity/domain/value-objects/invitees.vo';
import { describe, expect, it } from 'vitest';

const written = (raw: readonly string[]) =>
  Invitees.of(raw).addresses.map((each) => each.value);

describe('Invitees', () => {
  it('names each address once, however it was written', () => {
    expect(
      written(['Ada@Example.com', 'ada@example.com ', 'grace@example.com']),
    ).toEqual(['ada@example.com', 'grace@example.com']);
  });

  it('rejects something that is not an address', () => {
    expect(() => Invitees.of(['ada@example.com', 'grace'])).toThrow(
      InvalidEmailAddressError,
    );
  });

  it('rejects an invite to nobody, or to too many at once', () => {
    expect(() => Invitees.of([])).toThrow(InviteeCountError);
    expect(() =>
      Invitees.of(
        Array.from(
          { length: MOST_INVITED_AT_ONCE + 1 },
          (_, at) => `person${at}@example.com`,
        ),
      ),
    ).toThrow(InviteeCountError);
  });
});
