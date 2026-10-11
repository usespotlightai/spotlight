import type {
  Redeemed,
  RunRedemption,
} from '@secrets/application/contracts/run-redemption.contract';

export const RUN_REDEMPTIONS = Symbol('RUN_REDEMPTIONS');

export interface RunSealed {
  readonly runId: string;
  readonly name: string;
  readonly value: string;
  readonly recipient: string;
}

export interface RunRedemptionsPort {
  redeem(redemption: RunRedemption): Promise<Redeemed>;

  sealedFor(sealed: RunSealed): string;
}
