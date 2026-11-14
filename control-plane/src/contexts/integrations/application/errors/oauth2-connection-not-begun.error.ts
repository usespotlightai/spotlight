import type { ConnectionOwnerKind } from '@integrations/domain/value-objects/connection-owner.vo';
import {
  ApplicationError,
  type ApplicationErrorKind,
} from '@shared-kernel/application/errors/application-error';

export type OAuth2NotBegunReason =
  | 'not-a-member'
  | 'not-allowed'
  | 'takes-no-connection'
  | 'no-oauth2-endpoints'
  | 'no-client'
  | 'not-registered'
  | 'not-begun';

interface NotBegunAbout {
  readonly teamId: string;
  readonly integration: string;
  readonly owner: ConnectionOwnerKind;
}

const ACCOUNT: Record<ConnectionOwnerKind, string> = {
  team: 'a team account',
  person: 'a personal account',
};

const REFUSALS: Record<
  OAuth2NotBegunReason,
  {
    readonly kind: ApplicationErrorKind;
    readonly message: (about: NotBegunAbout) => string;
  }
> = {
  'not-a-member': {
    kind: 'not-found',
    message: ({ teamId }) => `Team ${teamId} not found.`,
  },
  'not-allowed': {
    kind: 'not-allowed',
    message: () =>
      'Only a workspace owner or admin can connect a team account.',
  },
  'takes-no-connection': {
    kind: 'not-found',
    message: ({ integration, owner }) =>
      `Integration ${integration} doesn't take ${ACCOUNT[owner]}.`,
  },
  'no-oauth2-endpoints': {
    kind: 'upstream-error',
    message: ({ integration }) =>
      `OAuth2 endpoints for integration ${integration} not found.`,
  },
  'no-client': {
    kind: 'not-found',
    message: ({ integration }) =>
      `Integration ${integration} has no OAuth2 client. Required: an OAUTH_CLIENTS entry for ${integration}`,
  },
  'not-registered': {
    kind: 'upstream-error',
    message: ({ integration }) =>
      `Client registration for integration ${integration} failed.`,
  },
  'not-begun': {
    kind: 'upstream-error',
    message: ({ integration }) =>
      `OAuth2 endpoints for integration ${integration} not found.`,
  },
};

export class OAuth2ConnectionNotBegunError extends ApplicationError {
  readonly kind: ApplicationErrorKind;

  constructor(
    readonly reason: OAuth2NotBegunReason,
    about: NotBegunAbout,
  ) {
    super(REFUSALS[reason].message(about));
    this.kind = REFUSALS[reason].kind;
    this.name = 'OAuth2ConnectionNotBegunError';
  }
}
