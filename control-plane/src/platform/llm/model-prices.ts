import type { ModelCost } from '@shared-kernel/domain/value-objects/model-usage.vo';

export const MODEL_PRICES = Symbol('MODEL_PRICES');

const PER_MILLION = 1_000_000;

export const PRICE_CURRENCY = 'USD';

interface Rates {
  readonly input: number;
  readonly output: number;
  readonly cachedInput: number | null;
}

export interface TokenPrice extends Rates {
  readonly above: readonly (Rates & { readonly inputTokens: number })[];
}

export interface PricedTokens {
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cachedInputTokens: number | null;
}

export interface ModelPrices {
  priceOf(baseUrl: string, model: string): TokenPrice | null;
  refresh(): Promise<void>;
}

export const NO_PRICES: ModelPrices = {
  priceOf: () => null,
  refresh: async () => undefined,
};

const ratesFor = (price: TokenPrice, inputTokens: number): Rates =>
  [...price.above]
    .sort((a, b) => b.inputTokens - a.inputTokens)
    .find((tier) => inputTokens > tier.inputTokens) ?? price;

export const costOf = (
  price: TokenPrice,
  tokens: PricedTokens,
): ModelCost | null => {
  if (tokens.inputTokens === null || tokens.outputTokens === null) {
    return null;
  }

  const rates = ratesFor(price, tokens.inputTokens);
  const cached = Math.min(tokens.cachedInputTokens ?? 0, tokens.inputTokens);
  const cachedRate = rates.cachedInput ?? rates.input;

  return {
    amount:
      ((tokens.inputTokens - cached) * rates.input +
        cached * cachedRate +
        tokens.outputTokens * rates.output) /
      PER_MILLION,
    currency: PRICE_CURRENCY,
  };
};
