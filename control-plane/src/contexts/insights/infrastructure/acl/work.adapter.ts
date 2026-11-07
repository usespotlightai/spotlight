import type {
  ConfigInOrder,
  EndedRun,
  StationConfigView,
  TaskRun,
  TracedWanted,
  TracedWork,
  WorkPort,
} from '@insights/application/ports/work.port';
import type { UnfinishedRun } from '@insights/domain/services/unfinished-runs';
import { ConfigFingerprint } from '@insights/domain/value-objects/config-fingerprint.vo';
import { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { StationConfigShape } from '@work/application/contracts/station-config.contract';
import type {
  EndedStationRun,
  StationRunsPort,
} from '@work/application/ports/station-runs.port';

const configViewOf = (config: StationConfigShape): StationConfigView => ({
  prompt: config.prompt,
  harness: config.harness,
  model: config.model,
  effort: config.effort,
  profile: config.profile,
  image: config.image,
  repositories: config.repositories.map((each) => ({
    name: each.name,
    setup: each.setup,
  })),
  skills: config.skills.map((each) => ({ key: each.key, hash: each.hash })),
  tools: config.tools,
  decisions: config.decisions,
  memories: config.memories,
  ...(config.judge
    ? {
        judge: {
          rubricVersion: RubricVersion.of(config.judge.rubricHash),
          sample: config.judge.sample,
          minAgreement: config.judge.minAgreement,
        },
      }
    : {}),
});

export class Work implements WorkPort {
  constructor(
    private readonly stations: StationRunsPort,
    private readonly logger: LoggerPort,
  ) {}

  async endedRun(runId: RunId): Promise<EndedRun | null> {
    const run = await this.stations.ended(runId.value);

    if (!run) {
      return null;
    }

    return {
      runId: RunId.of(run.runId),
      workspaceId: WorkspaceId.of(run.workspaceId),
      teamId: TeamId.of(run.teamId),
      lineId: LineId.of(run.lineId),
      stationId: StationId.of(run.stationId),
      taskId: TaskId.of(run.taskId),
      fingerprint: this.fingerprintOf(run),
      visit: run.visit,
      harness: run.harness,
      model: run.model,
      effort: run.effort,
      profileKey: run.profileKey,
      repositories: run.repositories,
      skills: run.skills,
      queuedAt: run.queuedAt,
      startedAt: run.startedAt,
      endedAt: run.endedAt,
    };
  }

  private fingerprintOf(run: EndedStationRun): ConfigFingerprint | null {
    const fingerprint = ConfigFingerprint.readable(run.fingerprint);

    if (run.fingerprint !== null && fingerprint === null) {
      this.logger.warn(
        {
          runId: run.runId,
          stationId: run.stationId,
          fingerprint: run.fingerprint,
        },
        'Run ended with a malformed config fingerprint, recorded as no config',
      );
    }

    return fingerprint;
  }

  async taskRunOf(runId: RunId): Promise<TaskRun | null> {
    const run = await this.stations.taskRunOf(runId.value);

    return run
      ? {
          runId: RunId.of(run.runId),
          taskId: TaskId.of(run.taskId),
          teamId: TeamId.of(run.teamId),
        }
      : null;
  }

  async unfinishedRuns(teamId: TeamId): Promise<readonly UnfinishedRun[]> {
    return (await this.stations.unfinished(teamId.value)).map((run) => ({
      runId: run.runId,
      taskId: run.taskId,
      lineId: run.lineId,
      stationId: run.stationId,
      openedBy: run.openedBy,
      harness: run.harness,
      model: run.model,
      progress: run.progress,
      queuedAt: run.queuedAt,
      startedAt: run.startedAt,
    }));
  }

  async traced(wanted: TracedWanted): Promise<TracedWork> {
    const found = await this.stations.traced(wanted);

    return {
      tasks: found.tasks.map((each) => ({
        taskId: each.taskId,
        title: each.title,
        input: each.input,
        stationId: each.stationId,
      })),
      stations: found.stations.map((each) => ({
        stationId: each.stationId,
        name: each.name,
        color: each.color,
        position: each.position,
        count: each.count,
      })),
      outputs: found.outputs,
    };
  }

  async configsInOrder(
    fingerprints: readonly string[],
  ): Promise<readonly ConfigInOrder[]> {
    if (fingerprints.length === 0) {
      return [];
    }

    return (await this.stations.configsInOrder(fingerprints)).map((each) => ({
      fingerprint: each.fingerprint,
      config: configViewOf(each.config),
      changes: each.changes.map((change) => ({
        part: change.part,
        name: change.name,
        kind: change.kind,
        was: change.was,
        now: change.now,
      })),
    }));
  }
}
