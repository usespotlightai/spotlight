import type { LeasedWork } from '@runners/application/ports/runners.port';

export const RUNNER_EGRESS = Symbol('RUNNER_EGRESS');

export interface EgressAuthentication {
  readonly runnerId: string;
  readonly workspaceId: string;
  readonly work: LeasedWork;
}

export interface SharedEgressAuthentication {
  readonly egressId: string;
  readonly runnerId: string;
  readonly workspaceId: string;
  readonly work: LeasedWork | null;
}

export interface SharedEgress {
  readonly egressId: string;
}

export interface RunnerEgressPort {
  authenticate(
    token: string | undefined,
    at: Date,
  ): Promise<EgressAuthentication | null>;

  sharedWith(token: string | undefined): Promise<SharedEgress | null>;

  authorizeRunner(
    egress: SharedEgress,
    proxyCredential: string,
    at: Date,
  ): Promise<SharedEgressAuthentication | null>;

  runnerForConnectionRecords(
    egress: SharedEgress,
    proxyCredential: string,
    at: Date,
  ): Promise<SharedEgressAuthentication | null>;
}
