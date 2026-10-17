import type { CredentialSourceKind } from '@runners/application/ports/runner-authenticator.port';

export interface CredentialSourceDto {
  readonly kind: CredentialSourceKind;
  readonly key: string | null;
}

interface HostHarnessDto {
  readonly id: string;
  readonly version: string | null;
}

interface HostImageDto {
  readonly image: string;
  readonly digest: string | null;
  readonly isDefault: boolean;
  readonly release: string | null;
  readonly harnesses: readonly HostHarnessDto[];
  readonly unavailableReason: string | null;
}

export interface HostDto {
  readonly id: string;
  readonly name: string;
  readonly source: CredentialSourceDto;
  readonly release: string;
  readonly containerRuntime: string;
  readonly capacity: number;
  readonly running: readonly string[];
  readonly images: readonly HostImageDto[];
  readonly firstHeartbeatAt: string;
  readonly onlineSince: string;
  readonly lastHeartbeatAt: string;
  readonly online: boolean;
}

export interface LiveRunnerDto {
  readonly id: string;
  readonly source: CredentialSourceDto;
  readonly hostId: string | null;
  readonly image: string | null;
  readonly harnesses: readonly string[];
  readonly startedAt: string;
  readonly lastHeartbeatAt: string | null;
}

export interface RunnerFleetDto {
  readonly hosts: readonly HostDto[];
  readonly runners: readonly LiveRunnerDto[];
}
