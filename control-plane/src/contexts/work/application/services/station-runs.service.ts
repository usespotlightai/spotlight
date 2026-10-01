import type { FingerprintedConfig } from '@work/application/contracts/station-config.contract';
import type { StationRunReaderPort } from '@work/application/ports/station-run-reader.port';
import type {
  EndedStationRun,
  StationRunsPort,
} from '@work/application/ports/station-runs.port';
import { roundAfter } from '@work/domain/services/station-round';
import { StationConfig } from '@work/domain/value-objects/station-config.vo';

export class StationRuns implements StationRunsPort {
  constructor(private readonly reader: StationRunReaderPort) {}

  async ended(runId: string): Promise<EndedStationRun | null> {
    const found = await this.reader.endedRun(runId);

    if (!found) {
      return null;
    }

    const { earlier, config, ...run } = found;

    return {
      ...run,
      round: roundAfter(earlier),
      harness: config?.harness ?? run.harness,
      model: config?.model ?? null,
      effort: config?.effort ?? null,
      profileKey: config?.profile?.key ?? null,
      repositories: config?.repositories.map((each) => each.name) ?? [],
    };
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
