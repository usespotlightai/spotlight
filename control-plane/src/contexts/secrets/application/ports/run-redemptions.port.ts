import type {
  Redeemed,
  RunRedemption,
} from '@secrets/application/contracts/run-redemption.contract';

export const RUN_REDEMPTIONS = Symbol('RUN_REDEMPTIONS');

export interface RunRedemptionsPort {
  redeem(redemption: RunRedemption): Promise<Redeemed>;
}
