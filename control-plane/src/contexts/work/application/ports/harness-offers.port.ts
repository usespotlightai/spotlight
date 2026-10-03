export const HARNESS_OFFERS = Symbol('HARNESS_OFFERS');

export interface HarnessOffer {
  readonly models: readonly string[];
  readonly efforts: readonly string[];
}

export interface HarnessOffersPort {
  offerOf(workspaceId: string, harness: string): Promise<HarnessOffer | null>;
}
