import type { Fetch } from '@platform/llm/chat-completions';
import type { ModelPrices, TokenPrice } from '@platform/llm/model-prices';
import { z } from 'zod';

const MAX_WAIT_MS = 60_000;

const PROVIDER_HOSTS: Readonly<Record<string, string>> = {
  'api.openai.com': 'openai',
  'api.anthropic.com': 'anthropic',
  'generativelanguage.googleapis.com': 'google',
  'api.mistral.ai': 'mistral',
  'api.groq.com': 'groq',
  'api.x.ai': 'xai',
  'api.together.xyz': 'togetherai',
  'api.cerebras.ai': 'cerebras',
  'api.deepinfra.com': 'deepinfra',
  'api.perplexity.ai': 'perplexity',
  'api.cohere.ai': 'cohere',
};

const rate = z.number().nonnegative();

const COST = z.object({
  input: rate,
  output: rate,
  cache_read: rate.optional(),
  tiers: z
    .array(
      z.object({
        input: rate,
        output: rate,
        cache_read: rate.optional(),
        tier: z.object({ type: z.literal('context'), size: z.number() }),
      }),
    )
    .optional()
    .catch(undefined),
});

const CATALOG = z.record(
  z.string(),
  z.object({
    api: z.string().optional().catch(undefined),
    models: z.record(
      z.string(),
      z.object({ cost: COST.optional().catch(undefined) }),
    ),
  }),
);

const hostOf = (url: string): string | null => {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
};

const priceOfCost = (cost: z.infer<typeof COST>): TokenPrice => ({
  input: cost.input,
  output: cost.output,
  cachedInput: cost.cache_read ?? null,
  above: (cost.tiers ?? []).map((tier) => ({
    inputTokens: tier.tier.size,
    input: tier.input,
    output: tier.output,
    cachedInput: tier.cache_read ?? null,
  })),
});

const pricesOfCatalog = (
  raw: unknown,
): ReadonlyMap<string, ReadonlyMap<string, TokenPrice>> => {
  const catalog = CATALOG.parse(raw);
  const byHost = new Map<string, Map<string, TokenPrice>>();
  const providerHosts = new Map<string, string[]>();

  for (const [host, provider] of Object.entries(PROVIDER_HOSTS)) {
    providerHosts.set(provider, [...(providerHosts.get(provider) ?? []), host]);
  }

  for (const [id, provider] of Object.entries(catalog)) {
    const apiHost = provider.api ? hostOf(provider.api) : null;
    const hosts = [
      ...(apiHost ? [apiHost] : []),
      ...(providerHosts.get(id) ?? []),
    ];

    for (const host of hosts) {
      if (byHost.has(host)) {
        continue;
      }

      const models = new Map<string, TokenPrice>();

      for (const [model, entry] of Object.entries(provider.models)) {
        if (entry.cost) {
          models.set(model, priceOfCost(entry.cost));
        }
      }
      byHost.set(host, models);
    }
  }

  return byHost;
};

export class ModelsDevPrices implements ModelPrices {
  #prices: ReadonlyMap<string, ReadonlyMap<string, TokenPrice>> = new Map();

  constructor(
    private readonly url: string,
    private readonly fetch: Fetch = globalThis.fetch,
  ) {}

  get loaded(): boolean {
    return this.#prices.size > 0;
  }

  async refresh(): Promise<void> {
    const response = await this.fetch(this.url, {
      signal: AbortSignal.timeout(MAX_WAIT_MS),
    });

    if (!response.ok) {
      throw new Error(
        `The model price catalog answered ${response.status} ${response.statusText}`,
      );
    }

    this.#prices = pricesOfCatalog(await response.json());
  }

  priceOf(baseUrl: string, model: string): TokenPrice | null {
    const host = hostOf(baseUrl);

    return host === null ? null : (this.#prices.get(host)?.get(model) ?? null);
  }
}
