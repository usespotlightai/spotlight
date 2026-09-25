import type { AdmissionKind } from '@runners/domain/value-objects/admission.vo';

export interface AdmittedThroughDto {
  readonly kind: AdmissionKind;
  readonly key: string | null;
}

export interface HostDto {
  readonly id: string;
  readonly name: string;
  readonly through: AdmittedThroughDto;
  readonly release: string;
  readonly executor: string;
  readonly capacity: number;
  readonly running: readonly string[];
  readonly harnesses: readonly string[];
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly answering: boolean;
}

export interface LiveRunnerDto {
  readonly id: string;
  readonly through: AdmittedThroughDto;
  readonly hostId: string | null;
  readonly harnesses: readonly string[];
  readonly startedAt: string;
  readonly lastSeenAt: string | null;
}

export interface RunnerFleetDto {
  readonly hosts: readonly HostDto[];
  readonly runners: readonly LiveRunnerDto[];
}
