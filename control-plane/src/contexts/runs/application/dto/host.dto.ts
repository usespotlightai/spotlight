import type { ClaimedWorkDto } from '@runs/application/dto/run.dto';

export interface WarmSandboxStartDto {
  readonly line: string;
  readonly checkouts: readonly {
    readonly path: string;
    readonly setup: string | null;
  }[];
}

export type HostClaimDto =
  | { readonly outcome: 'unauthorized' }
  | { readonly outcome: 'nothing' }
  | { readonly outcome: 'host-unreported' }
  | {
      readonly outcome: 'host-outdated';
      readonly release: string;
      readonly minimum: string;
    }
  | { readonly outcome: 'image-unreported' }
  | {
      readonly outcome: 'claimed';
      readonly runnerId: string;
      readonly token: string;
      readonly egressToken: string;
      readonly sandboxId: string | null;
      readonly sandboxToken: string | null;
      readonly reused: boolean;
      readonly work: ClaimedWorkDto;
    }
  | {
      readonly outcome: 'sandbox';
      readonly sandboxId: string;
      readonly sandboxToken: string;
      readonly allowedHosts: readonly string[];
      readonly warm: WarmSandboxStartDto | null;
    };
