import type { ClaimedWorkDto } from '@work/application/dto/run.dto';

export type PoolClaimDto =
  | { readonly outcome: 'refused' }
  | { readonly outcome: 'nothing' }
  | {
      readonly outcome: 'claimed';
      readonly runnerId: string;
      readonly token: string;
      readonly work: ClaimedWorkDto;
    };

export interface PoolQueueDto {
  readonly pending: number;
  readonly running: number;
  readonly capacity: number | null;
  readonly labels: Readonly<Record<string, number>>;
}
