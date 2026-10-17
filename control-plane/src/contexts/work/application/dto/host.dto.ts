import type { ClaimedWorkDto } from '@work/application/dto/run.dto';

export type HostClaimDto =
  | { readonly outcome: 'unauthorized' }
  | { readonly outcome: 'nothing' }
  | { readonly outcome: 'stranger' }
  | { readonly outcome: 'unoffered' }
  | {
      readonly outcome: 'claimed';
      readonly runnerId: string;
      readonly token: string;
      readonly egressToken: string;
      readonly work: ClaimedWorkDto;
    };
