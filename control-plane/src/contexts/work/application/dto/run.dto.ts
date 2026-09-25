import type { ClaimedCheck } from '@work/application/ports/check-work.port';

interface ClaimedRunDto {
  readonly id: string;
  readonly harness: string;
  readonly spec: unknown;
}

export type ClaimedWorkDto =
  | { readonly kind: 'run'; readonly run: ClaimedRunDto }
  | { readonly kind: 'check'; readonly check: ClaimedCheck };

export interface EnqueuedRunDto {
  readonly id: string;
  readonly harness: string;
  readonly state: string;
}
