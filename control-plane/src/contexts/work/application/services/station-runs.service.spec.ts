import type { RunDigestReaderPort } from '@work/application/ports/run-digest-reader.port';
import type { StationRunReaderPort } from '@work/application/ports/station-run-reader.port';
import { StationRuns } from '@work/application/services/station-runs.service';
import { Money } from '@work/domain/value-objects/money.vo';
import { Tokens } from '@work/domain/value-objects/tokens.vo';
import { describe, expect, it } from 'vitest';

const digests: RunDigestReaderPort = {
  forRuns: async () =>
    new Map([
      [
        'run_1',
        {
          ms: 60_000,
          steps: 12,
          faults: 1,
          used: 40_000,
          size: 200_000,
          cost: Money.of(0.42, 'USD'),
          tokens: Tokens.of({
            input: 1_200,
            output: 900,
            cacheRead: 80_000,
          }),
        },
      ],
    ]),
};

describe('StationRuns.costsOf', () => {
  it('hands on each token count, with what was never reported left unknown', async () => {
    const stations = new StationRuns({} as StationRunReaderPort, digests);

    const costs = await stations.costsOf(['run_1']);

    expect(costs.get('run_1')).toEqual({
      ms: 60_000,
      steps: 12,
      faults: 1,
      used: 40_000,
      cost: 0.42,
      currency: 'USD',
      inputTokens: 1_200,
      outputTokens: 900,
      cacheReadTokens: 80_000,
      cacheWriteTokens: null,
    });
  });
});
