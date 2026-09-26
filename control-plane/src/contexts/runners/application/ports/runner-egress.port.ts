import type { HeldWork } from '@runners/application/ports/runners.port';

export const RUNNER_EGRESS = Symbol('RUNNER_EGRESS');

export interface EgressFor {
  readonly runnerId: string;
  readonly workspaceId: string;
  readonly work: HeldWork;
}

export interface RunnerEgressPort {
  admit(token: string | undefined, at: Date): Promise<EgressFor | null>;
}
