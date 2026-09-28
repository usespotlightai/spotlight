import type { WayInKind } from '@runners/application/ports/runner-admissions.port';

export interface AdmittedThroughDto {
  readonly kind: WayInKind;
  readonly key: string | null;
}

interface HostHarnessDto {
  readonly id: string;
  readonly version: string | null;
}

interface HostImageDto {
  readonly image: string;
  readonly digest: string | null;
  readonly usual: boolean;
  readonly release: string | null;
  readonly harnesses: readonly HostHarnessDto[];
  readonly refused: string | null;
}

export interface HostDto {
  readonly id: string;
  readonly name: string;
  readonly through: AdmittedThroughDto;
  readonly release: string;
  readonly executor: string;
  readonly capacity: number;
  readonly running: readonly string[];
  readonly images: readonly HostImageDto[];
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly answering: boolean;
}

export interface LiveRunnerDto {
  readonly id: string;
  readonly through: AdmittedThroughDto;
  readonly hostId: string | null;
  readonly image: string | null;
  readonly harnesses: readonly string[];
  readonly startedAt: string;
  readonly lastSeenAt: string | null;
}

export interface RunnerFleetDto {
  readonly hosts: readonly HostDto[];
  readonly runners: readonly LiveRunnerDto[];
}
