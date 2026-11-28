import { nonEmpty } from '@shared-kernel/domain/non-empty';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { FingerprintedConfig } from '@work/application/contracts/station-config.contract';
import type { StationRunReaderPort } from '@work/application/ports/station-run-reader.port';
import type {
  EndedStationRun,
  RunHarnessChoice,
  StationRunsPort,
  StationTaskRun,
  TracedRunsWanted,
  TracedWork,
  UnfinishedStationRun,
} from '@work/application/ports/station-runs.port';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import { runNumberAfter } from '@work/domain/services/station-run-number';
import { StationConfig } from '@work/domain/value-objects/station-config.vo';

const PREVIEW_LIMIT = 300;

const shortened = (text: string | null | undefined): string | null => {
  const trimmed = text?.trim();
  return nonEmpty(trimmed) ? trimmed.slice(0, PREVIEW_LIMIT) : null;
};

export class StationRuns implements StationRunsPort {
  constructor(
    private readonly reader: StationRunReaderPort,
    private readonly dispatches: DispatchRepository,
  ) {}

  async taskRunOf(runId: string): Promise<StationTaskRun | null> {
    const dispatch = await this.dispatches.find(RunId.of(runId));
    const subject = dispatch?.subject;

    return subject?.kind === 'task' && dispatch?.teamId
      ? {
          runId,
          workspaceId: dispatch.workspaceId.value,
          taskId: subject.taskId.value,
          teamId: dispatch.teamId.value,
        }
      : null;
  }

  async harnessChoiceOf(runId: string): Promise<RunHarnessChoice | null> {
    const dispatch = await this.dispatches.find(RunId.of(runId));
    const parts = dispatch?.configuredAs?.parts;

    return parts
      ? { harness: parts.harness, model: parts.model, effort: parts.effort }
      : null;
  }

  async ended(runId: string): Promise<EndedStationRun | null> {
    const found = await this.reader.endedRun(runId);

    if (!found) {
      return null;
    }

    const { earlier, config, ...run } = found;

    return {
      ...run,
      runNumber: runNumberAfter(earlier),
      harness: config?.harness ?? run.harness,
      model: config?.model ?? null,
      effort: config?.effort ?? null,
      profileKey: config?.profile?.key ?? null,
      skills: config?.skills.map((each) => each.key) ?? [],
    };
  }

  async unfinished(teamId: string): Promise<readonly UnfinishedStationRun[]> {
    const rows = await this.reader.unfinishedOfTeam(TeamId.of(teamId));

    return rows.flatMap(({ config, progress, ...run }) => {
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

  async traced(wanted: TracedRunsWanted): Promise<TracedWork> {
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
          return nonEmpty(output) ? [[taskId, output] as const] : [];
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
