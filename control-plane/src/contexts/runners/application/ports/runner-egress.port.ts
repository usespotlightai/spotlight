import type { HeldWork } from '@runners/application/ports/runners.port';

export const RUNNER_EGRESS = Symbol('RUNNER_EGRESS');

export interface EgressFor {
  readonly runnerId: string;
  readonly workspaceId: string;
  readonly work: HeldWork;
}

export interface SharedEgressFor {
  readonly egressId: string;
  readonly runnerId: string;
  readonly workspaceId: string;
  readonly work: HeldWork | null;
}

export interface SharedEgress {
  readonly egressId: string;
}

export interface RunnerEgressPort {
  admit(token: string | undefined, at: Date): Promise<EgressFor | null>;

  sharedWith(token: string | undefined): Promise<SharedEgress | null>;

  admitThrough(
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
