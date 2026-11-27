import type { LiveSandboxStatus } from '@runners/domain/aggregates/sandbox.aggregate';

export type CredentialSourceDto =
  | {
      readonly kind: 'pool';
      readonly key: string | null;
      readonly platform: { readonly egress: boolean } | null;
    }
  | { readonly kind: 'trust'; readonly key: string | null };

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

export interface IdleSandboxDto {
  readonly id: string;
  readonly workingCopyKey: string | null;
  readonly warmLineId: string | null;
  readonly image: string | null;
  readonly status: LiveSandboxStatus;
  readonly idleSince: string;
  readonly startedAt: string;
}

export interface HostDto {
  readonly id: string;
  readonly name: string;
  readonly source: CredentialSourceDto;
  readonly release: string;
  readonly unavailableReason: string | null;
  readonly containerRuntime: string;
  readonly capacity: number;
  readonly slotsTaken: number;
  readonly slotsOffered: number;
  readonly idleSandboxes: readonly IdleSandboxDto[];
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
  readonly readyToRun: boolean;
}
