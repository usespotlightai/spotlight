export type ConnectDenial = 'not-workspace-admin' | 'not-installation-admin';

const MESSAGES: Record<ConnectDenial, string> = {
  'not-workspace-admin': 'Only a workspace owner or admin can connect GitHub.',
  'not-installation-admin': 'You are not an admin of this GitHub installation.',
};

export class ConnectForbiddenError extends Error {
  readonly kind = 'not-allowed' as const;

  constructor(readonly denial: ConnectDenial) {
    super(MESSAGES[denial]);
    this.name = 'ConnectForbiddenError';
  }
}
