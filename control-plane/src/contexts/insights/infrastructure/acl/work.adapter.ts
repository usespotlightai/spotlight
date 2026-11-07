import type {
  ConfigInOrder,
  EndedRun,
  StationConfigView,
  TracedWanted,
  TracedWork,
  WorkPort,
} from '@insights/application/ports/work.port';
import type { UnfinishedRun } from '@insights/domain/services/unfinished-runs';
import type { StationConfigShape } from '@work/application/contracts/station-config.contract';
import type { StationRunsPort } from '@work/application/ports/station-runs.port';

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
          rubricVersion: config.judge.rubricHash,
          sample: config.judge.sample,
          minAgreement: config.judge.minAgreement,
        },
      }
    : {}),
});

export class Work implements WorkPort {
  constructor(private readonly stations: StationRunsPort) {}

  async endedRun(runId: string): Promise<EndedRun | null> {
    const run = await this.stations.ended(runId);

    if (!run) {
      return null;
    }

    return {
      runId: run.runId,
      workspaceId: run.workspaceId,
      teamId: run.teamId,
      lineId: run.lineId,
      stationId: run.stationId,
      taskId: run.taskId,
      fingerprint: run.fingerprint,
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

  async unfinishedRuns(teamId: string): Promise<readonly UnfinishedRun[]> {
    return (await this.stations.unfinished(teamId)).map((run) => ({
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
