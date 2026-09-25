import type { AdmissionKind } from '@runners/domain/value-objects/admission.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUNNER_ADMISSIONS = Symbol('RUNNER_ADMISSIONS');

export interface HostCredential {
  readonly bearer: string | undefined;
  readonly trust: string | undefined;
}

export interface AdmittedWay {
  readonly kind: AdmissionKind;
  readonly id: string;
}

export interface AdmittedHost {
  readonly way: AdmittedWay;
  readonly workspaceId: WorkspaceId;
}

export interface RunnerAdmissionsPort {
  admit(credential: HostCredential): Promise<AdmittedHost | null>;
}
