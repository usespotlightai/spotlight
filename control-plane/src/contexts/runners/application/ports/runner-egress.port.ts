import type { LeasedWork } from '@runners/application/ports/runners.port';

export const RUNNER_EGRESS = Symbol('RUNNER_EGRESS');

export interface EgressFor {
  readonly runnerId: string;
  readonly workspaceId: string;
  readonly work: LeasedWork;
}

export interface SharedEgressFor {
  readonly egressId: string;
  readonly runnerId: string;
  readonly workspaceId: string;
  readonly work: LeasedWork | null;
}

export interface SharedEgress {
  readonly egressId: string;
}

export interface RunnerEgressPort {
  authenticate(token: string | undefined, at: Date): Promise<EgressFor | null>;

  sharedWith(token: string | undefined): Promise<SharedEgress | null>;

  authorizeRunner(
    egress: SharedEgress,
    proxyCredential: string,
    at: Date,
  ): Promise<SharedEgressFor | null>;

  recordsThrough(
    egress: SharedEgress,
    proxyCredential: string,
    at: Date,
  ): Promise<SharedEgressFor | null>;
}
