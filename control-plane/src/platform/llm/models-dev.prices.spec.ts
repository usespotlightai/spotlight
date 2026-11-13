import { costOf } from '@platform/llm/model-prices';
import { ModelsDevPrices } from '@platform/llm/models-dev.prices';
import { describe, expect, it } from 'vitest';

const CATALOG = {
  openrouter: {
    api: 'https://openrouter.ai/api/v1',
    models: {
      'google/gemini-3.8-flash': {
        cost: { input: 0.75, output: 3.75, cache_read: 0.075 },
      },
      'free/model': {},
    },
  },
  openai: {
    models: {
      'gpt-5.4': {
        cost: {
          input: 2.5,
          output: 15,
          cache_read: 0.25,
          tiers: [
            {
              input: 5,
              output: 22.5,
              cache_read: 0.5,
              tier: { type: 'context', size: 272_000 },
            },
          ],
        },
      },
    },
  },
  oddity: { api: 'not a url', models: { m: { cost: { input: 'free' } } } },
};

const loaded = async (catalog: unknown = CATALOG) => {
  const requested: string[] = [];
  const prices = new ModelsDevPrices('https://models.dev/api.json', (async (
    url: string,
  ) => {
    requested.push(url);
    return new Response(JSON.stringify(catalog));
  }) as unknown as typeof globalThis.fetch);

  await prices.refresh();
  return { prices, requested };
};

describe('model prices from models.dev', () => {
  it('reads the catalog from its URL', async () => {
    const { requested } = await loaded();

    expect(requested).toEqual(['https://models.dev/api.json']);
  });

  it('finds the provider by the API host the catalog lists', async () => {
    const { prices } = await loaded();

    expect(
      prices.priceOf(
        'https://openrouter.ai/api/v1/',
        'google/gemini-3.8-flash',
      ),
    ).toEqual({ input: 0.75, output: 3.75, cachedInput: 0.075, above: [] });
  });

  it('finds a first-party provider the catalog lists without a host', async () => {
    const { prices } = await loaded();

    expect(prices.priceOf('https://api.openai.com/v1', 'gpt-5.4')?.input).toBe(
      2.5,
    );
  });

  it('knows no price for an unknown host, an unknown model or a model without a cost', async () => {
    const { prices } = await loaded();

    expect(prices.priceOf('http://localhost:11434/v1', 'gpt-5.4')).toBeNull();
    expect(prices.priceOf('https://api.openai.com/v1', 'gpt-0')).toBeNull();
    expect(
      prices.priceOf('https://openrouter.ai/api/v1', 'free/model'),
    ).toBeNull();
  });

  it('prices a long prompt at its context tier', async () => {
    const { prices } = await loaded();
    const price = prices.priceOf('https://api.openai.com/v1', 'gpt-5.4');

    expect(price).not.toBeNull();
    if (!price) {
      return;
    }
    expect(
      costOf(price, {
        inputTokens: 300_000,
        outputTokens: 0,
        cachedInputTokens: null,
      })?.amount,
    ).toBeCloseTo(1.5);
    expect(
      costOf(price, {
        inputTokens: 100_000,
        outputTokens: 0,
        cachedInputTokens: null,
      })?.amount,
    ).toBeCloseTo(0.25);
  });

  it('keeps no prices when the catalog does not answer', async () => {
    const prices = new ModelsDevPrices(
      'https://models.dev/api.json',
      async () =>
        new Response('down', {
          status: 503,
        }),
    );

    await expect(prices.refresh()).rejects.toThrow('503');
    expect(prices.loaded).toBe(false);
  });
});
