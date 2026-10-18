import type { ClaimedWorkDto } from '@work/application/dto/run.dto';

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
      readonly work: ClaimedWorkDto;
    };
