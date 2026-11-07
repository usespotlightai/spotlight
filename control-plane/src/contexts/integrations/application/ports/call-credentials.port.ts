import type { Credentials } from '@integrations/application/ports/integration-runtime.port';

export const CALL_CREDENTIALS = Symbol('CALL_CREDENTIALS');

export interface RunOfCall {
  readonly workspaceId: string;
  readonly runId: string;
  readonly attempt: number;
}

export interface CallCredentialsPort {
  forSpotlight(workspaceOf: () => Promise<string>): Credentials;

  forRun(run: RunOfCall): Credentials;
}
