import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { FingerprintedConfig } from '@work/application/contracts/station-config.contract';
import type { RunDigestReaderPort } from '@work/application/ports/run-digest-reader.port';
import type { StationRunReaderPort } from '@work/application/ports/station-run-reader.port';
import type {
  EndedRunCost,
  EndedStationRun,
  StationRunsPort,
} from '@work/application/ports/station-runs.port';
import { roundAfter } from '@work/domain/services/station-round';
import { StationConfig } from '@work/domain/value-objects/station-config.vo';

export class StationRuns implements StationRunsPort {
  constructor(
    private readonly reader: StationRunReaderPort,
    private readonly digests: RunDigestReaderPort,
  ) {}

  async ended(runId: string): Promise<EndedStationRun | null> {
    const found = await this.reader.endedRun(runId);

    if (!found) {
      return null;
    }

    const { earlier, ...run } = found;

    return { ...run, round: roundAfter(earlier) };
  }

  async costsOf(
    runIds: readonly string[],
  ): Promise<ReadonlyMap<string, EndedRunCost>> {
    const digests = await this.digests.forRuns(
      runIds.map((each) => RunId.of(each)),
    );

    return new Map(
      [...digests.entries()].map(([runId, digest]) => [
        runId,
        {
          ms: digest.ms,
          steps: digest.steps,
          faults: digest.faults,
          used: digest.used,
          cost: digest.cost?.amount ?? null,
          currency: digest.cost?.currency ?? null,
          inputTokens: digest.tokens.input,
          outputTokens: digest.tokens.output,
          cacheReadTokens: digest.tokens.cacheRead,
          cacheWriteTokens: digest.tokens.cacheWrite,
        },
      ]),
    );
  }

  async configsInOrder(
    fingerprints: readonly string[],
  ): Promise<readonly FingerprintedConfig[]> {
    const named = new Map(
      (await this.reader.configsNamed(fingerprints)).map((each) => [
        each.fingerprint,
        StationConfig.rehydrate(each.parts, each.fingerprint),
      ]),
    );
    const known = fingerprints.flatMap((each) => {
      const config = named.get(each);
      return config ? [config] : [];
    });

    return known.map((config, at) => {
      const earlier = at > 0 ? known[at - 1] : undefined;

      return {
        fingerprint: config.fingerprint,
        config: config.parts,
        changes: earlier ? config.changesFrom(earlier) : [],
      };
    });
  }
}
