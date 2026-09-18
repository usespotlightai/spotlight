export type RefusalToConnect =
  | 'workspace-not-administered'
  | 'installation-not-administered';

const SAYING: Record<RefusalToConnect, string> = {
  'workspace-not-administered':
    'This workspace is not yours to connect: only an owner or an admin may',
  'installation-not-administered':
    'That is not an installation you administer on GitHub',
};

export class NotYoursToConnectError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(readonly refusal: RefusalToConnect) {
    super(SAYING[refusal]);
    this.name = 'NotYoursToConnectError';
  }
}
