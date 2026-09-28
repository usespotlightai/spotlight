import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUNNER_ADMISSIONS = Symbol('RUNNER_ADMISSIONS');

export interface HostCredential {
  readonly bearer: string | undefined;
  readonly trust: string | undefined;
}

export type WayInKind = 'pool' | 'trust';

export interface AdmittedWay {
  readonly kind: WayInKind;
  readonly id: string;
}

export interface AdmittedHost {
  readonly way: AdmittedWay;
  readonly workspaceId: WorkspaceId;
}

export interface RunnerAdmissionsPort {
  admit(credential: HostCredential): Promise<AdmittedHost | null>;
}
