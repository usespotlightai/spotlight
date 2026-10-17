export type ConnectDenial =
  | 'workspace-not-administered'
  | 'installation-not-administered';

const MESSAGES: Record<ConnectDenial, string> = {
  'workspace-not-administered':
    'Only a workspace owner or admin can connect GitHub.',
  'installation-not-administered':
    'You are not an admin of this GitHub installation.',
};

export class NotYoursToConnectError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(readonly denial: ConnectDenial) {
    super(MESSAGES[denial]);
    this.name = 'NotYoursToConnectError';
  }
}
