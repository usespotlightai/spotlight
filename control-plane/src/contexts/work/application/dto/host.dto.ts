import type { ClaimedWorkDto } from '@work/application/dto/run.dto';

export type HostClaimDto =
  | { readonly outcome: 'refused' }
  | { readonly outcome: 'nothing' }
  | { readonly outcome: 'stranger' }
  | {
      readonly outcome: 'claimed';
      readonly runnerId: string;
      readonly token: string;
      readonly work: ClaimedWorkDto;
    };
