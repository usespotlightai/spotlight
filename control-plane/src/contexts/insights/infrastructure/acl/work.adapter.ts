import type {
  ConfigInOrder,
  EndedRun,
  TracedWanted,
  TracedWork,
  WorkPort,
} from '@insights/application/ports/work.port';
import { InvalidAlertError } from '@insights/domain/exceptions/invalid-alert.error';
import type { UnfinishedRun } from '@insights/domain/services/unfinished-runs';
import { AlertRule } from '@insights/domain/value-objects/alert-rule.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { LineResourcesPort } from '@work/application/ports/line-resources.port';
import type {
  StationAlertShape,
  StationRunsPort,
} from '@work/application/ports/station-runs.port';

export class Work implements WorkPort {
  constructor(
    private readonly stations: StationRunsPort,
    private readonly lines: LineResourcesPort,
    private readonly logger: LoggerPort,
  ) {}

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
      config: each.config,
      changes: each.changes,
    }));
  }

  async alertsAt(stationId: string): Promise<readonly AlertRule[] | null> {
    const alerts = await this.stations.alertsAt(stationId);

    return alerts
      ? alerts.flatMap((each) => this.ruleOf(stationId, each))
      : null;
  }

  async teamRepositories(teamId: string): Promise<readonly string[]> {
    const names = (await this.lines.ofTeam(TeamId.of(teamId))).flatMap((line) =>
      line.definition.repositories.map((each) => each.name),
    );

    return [...new Set(names)];
  }

  teamSkillKeys(teamId: string): Promise<readonly string[]> {
    return this.stations.teamSkillKeys(teamId);
  }

  private ruleOf(
    stationId: string,
    alert: StationAlertShape,
  ): readonly AlertRule[] {
    try {
      return [AlertRule.of(alert)];
    } catch (error) {
      if (!(error instanceof InvalidAlertError)) {
        throw error;
      }

      this.logger.warn(
        { stationId, measure: alert.measure, reason: error.message },
        'Skipped a station alert that Insights cannot watch',
      );
      return [];
    }
  }
}
