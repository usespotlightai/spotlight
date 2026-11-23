import type { HostCredentials } from '@runners/application/ports/runner-authenticator.port';

// A host deleted the snapshot of a removed archive from its store.
export class ForgetSnapshotRemovalCommand {
  constructor(
    readonly credential: HostCredentials,
    readonly archiveId: string,
  ) {}
}
