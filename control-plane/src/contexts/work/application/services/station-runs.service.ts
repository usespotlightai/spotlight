import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { FingerprintedConfig } from '@work/application/contracts/station-config.contract';
import type {
  StationRunReaderPort,
  TracedWanted,
} from '@work/application/ports/station-run-reader.port';
import type {
  EndedStationRun,
  StationRunsPort,
  TracedWork,
  UnfinishedStationRun,
} from '@work/application/ports/station-runs.port';
import { visitAfter } from '@work/domain/services/station-visit';
import { reviewedOrAll } from '@work/domain/services/task-checkouts';
import { progressOf } from '@work/domain/value-objects/run-state';
import { StationConfig } from '@work/domain/value-objects/station-config.vo';

const PREVIEW_LIMIT = 300;

const shortened = (text: string | null | undefined): string | null => {
  const trimmed = text?.trim();
  return trimmed ? trimmed.slice(0, PREVIEW_LIMIT) : null;
};

export class StationRuns implements StationRunsPort {
  constructor(private readonly reader: StationRunReaderPort) {}

  async ended(runId: string): Promise<EndedStationRun | null> {
    const found = await this.reader.endedRun(runId);

    if (!found) {
      return null;
    }

    const { earlier, config, reviewing, ...run } = found;

    return {
      ...run,
      visit: visitAfter(earlier),
      harness: config?.harness ?? run.harness,
      model: config?.model ?? null,
      effort: config?.effort ?? null,
      profileKey: config?.profile?.key ?? null,
      repositories: reviewedOrAll(
        reviewing,
        config?.repositories.map((each) => each.name) ?? [],
      ),
      skills: config?.skills.map((each) => each.key) ?? [],
    };
  }

  async unfinished(teamId: string): Promise<readonly UnfinishedStationRun[]> {
    const rows = await this.reader.unfinishedOfTeam(TeamId.of(teamId));

    return rows.flatMap(({ config, state, stopRequested, ...run }) => {
      const progress = progressOf({ state, stopRequested });

      return progress
        ? [
            {
              ...run,
              harness: config?.harness ?? run.harness,
              model: config?.model ?? null,
              progress,
            },
          ]
        : [];
    });
  }

  async traced(wanted: TracedWanted): Promise<TracedWork> {
    const rows = await this.reader.traced(wanted);

    return {
      tasks: rows.tasks.map((each) => ({
        taskId: each.taskId,
        title: each.title,
        input: shortened(each.description),
        stationId: each.stationId,
      })),
      stations: rows.stations.map((each) => ({
        stationId: each.stationId,
        name: each.name,
        color: each.color,
        position: each.position,
        count: each.stations,
      })),
      outputs: new Map(
        [...rows.notes].flatMap(([taskId, body]) => {
          const output = shortened(body);
          return output ? [[taskId, output] as const] : [];
        }),
      ),
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
