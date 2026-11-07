import { Invitees } from '@identity/domain/value-objects/invitees.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';

export class InviteToWorkspaceCommand {
  constructor(
    readonly slug: string,
    readonly email: string,
    readonly role: string,
    readonly teamIds: readonly string[],
    readonly viewerId: string,
  ) {}
}

export const inviteesOf = (emails: readonly string[]): readonly string[] => {
  try {
    return Invitees.of(emails).addresses.map((each) => each.value);
  } catch (error) {
    rethrowAsApplicationError(error);
  }
};
