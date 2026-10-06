export type RefusalToConnect =
  | 'workspace-not-administered'
  | 'installation-not-administered';

const SAYING: Record<RefusalToConnect, string> = {
  'workspace-not-administered':
    'Only a workspace owner or admin can connect GitHub.',
  'installation-not-administered':
    'You are not an admin of this GitHub installation.',
};

export class NotYoursToConnectError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(readonly refusal: RefusalToConnect) {
    super(SAYING[refusal]);
    this.name = 'NotYoursToConnectError';
  }
}
