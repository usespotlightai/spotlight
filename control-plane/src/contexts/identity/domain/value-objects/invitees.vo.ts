import { InviteeCountError } from '@identity/domain/exceptions/invitee-count.error';
import { EmailAddress } from '@identity/domain/value-objects/email-address.vo';

export const MOST_INVITED_AT_ONCE = 50;

export class Invitees {
  private constructor(readonly addresses: readonly EmailAddress[]) {}

  static of(raw: readonly string[]): Invitees {
    const written = raw.map((each) => EmailAddress.of(each));
    const addresses = written.filter(
      (email, at) => written.findIndex((each) => each.equals(email)) === at,
    );

    if (addresses.length === 0 || addresses.length > MOST_INVITED_AT_ONCE) {
      throw new InviteeCountError(MOST_INVITED_AT_ONCE, addresses.length);
    }

    return new Invitees(addresses);
  }
}
