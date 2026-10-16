import type {
  RedeemedSecret,
  WithheldSecret,
} from '@secrets/application/contracts/run-redemption.contract';

export type EgressRedemptionDto =
  | { readonly outcome: 'refused' }
  | { readonly outcome: 'waiting' }
  | {
      readonly outcome: 'redeemed';
      readonly runId: string | null;
      readonly reaches: readonly string[];
      readonly bound: readonly string[];
      readonly secrets: readonly RedeemedSecret[];
      readonly withheld: readonly WithheldSecret[];
      readonly spotlightApi: { readonly sealed: string } | null;
    };

export type EgressRedeemed = Extract<
  EgressRedemptionDto,
  { readonly outcome: 'redeemed' }
>;
