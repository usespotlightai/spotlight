import type { Credentials } from '@integrations/application/ports/integration-runtime.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const CALL_CREDENTIALS = Symbol('CALL_CREDENTIALS');

export interface RunOfCall {
  readonly workspaceId: WorkspaceId;
  readonly runId: RunId;
  readonly attempt: number;
}

export interface CallCredentialsPort {
  forSpotlight(workspaceOf: () => Promise<WorkspaceId>): Credentials;

  forRun(run: RunOfCall): Credentials;
}
