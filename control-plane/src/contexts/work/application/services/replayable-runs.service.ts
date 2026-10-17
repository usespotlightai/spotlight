import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ReplayRefusalCode } from '@work/application/contracts/replay-refusal.contract';
import type { ReplayFactsPort } from '@work/application/ports/replay-facts.port';
import type {
  RecentRun,
  Replayability,
  ReplayableRunsPort,
  StandingRun,
} from '@work/application/ports/replayable-runs.port';
import type { RunDigestReaderPort } from '@work/application/ports/run-digest-reader.port';
import type { StationRunReaderPort } from '@work/application/ports/station-run-reader.port';
import type { DispatchReplay } from '@work/application/services/dispatch-replay.service';
import { UnreplayableRunError } from '@work/domain/exceptions/unreplayable-run.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { standingOf } from '@work/domain/services/replay-standing';

export class ReplayableRuns implements ReplayableRunsPort {
  constructor(
    private readonly facts: ReplayFactsPort,
    private readonly runs: RunRepository,
    private readonly lines: LineRepository,
    private readonly dispatch: DispatchReplay,
    private readonly stationRuns: StationRunReaderPort,
    private readonly digests: RunDigestReaderPort,
    private readonly ids: IdGeneratorPort,
    private readonly logger: LoggerPort,
  ) {}

  async check(
    workspaceId: string,
    runIds: readonly string[],
  ): Promise<readonly Replayability[]> {
    const workspace = WorkspaceId.of(workspaceId);
    const checked: Replayability[] = [];

    for (const runId of [...new Set(runIds)]) {
      checked.push(await this.checked(workspace, runId));
    }

    return checked;
  }

  async standing(
    workspaceId: string,
    runIds: readonly string[],
  ): Promise<readonly StandingRun[]> {
    const known = await this.facts.of(workspaceId, runIds);

    return [...new Set(runIds)].map((runId) => {
      const facts = known.get(runId) ?? null;
      const standing = standingOf(facts);
      const placed = facts?.inWorkspace ? facts : null;

      return {
        runId,
        taskId: placed?.taskId ?? null,
        stationId: placed?.stationId ?? null,
        refusal: standing?.refusal ?? null,
        reason: standing?.reason ?? null,
        title: placed?.title ?? null,
        state: placed?.state ?? null,
        endedAt: placed?.endedAt ?? null,
        origin: placed?.origin ?? null,
      };
    });
  }

  async durations(
    runIds: readonly string[],
  ): Promise<ReadonlyMap<string, number>> {
    if (runIds.length === 0) {
      return new Map();
    }

    const digests = await this.digests.forRuns(
      [...new Set(runIds)].map((each) => RunId.of(each)),
    );

    return new Map(
      [...digests].flatMap(([runId, digest]) =>
        digest.ms === null ? [] : [[runId, digest.ms] as const],
      ),
    );
  }

  async recentAt(
    workspaceId: string,
    stationId: string,
    max: number,
  ): Promise<readonly RecentRun[]> {
    const ended = await this.stationRuns.endedAt(stationId, {
      fingerprint: null,
      since: null,
      until: null,
      max,
      excluding: [],
    });
    const checked = new Map(
      (
        await this.standing(
          workspaceId,
          ended.map((each) => each.runId),
        )
      ).map((each) => [each.runId, each]),
    );

    return ended.flatMap((each) => {
      const replayable = checked.get(each.runId);

      return replayable && replayable.refusal !== 'unknown-run'
        ? [
            {
              ...replayable,
              title: each.title,
              state: each.state,
              endedAt: each.endedAt,
            },
          ]
        : [];
    });
  }

  private async checked(
    workspaceId: WorkspaceId,
    runId: string,
  ): Promise<Replayability> {
    const run = await this.runs.findById(RunId.of(runId));

    if (!run?.workspaceId.equals(workspaceId)) {
      return refused(
        runId,
        null,
        null,
        'unknown-run',
        'The run is not in this workspace.',
      );
    }

    const taskId = run.taskId?.value ?? null;
    const stationId = run.stationId?.value ?? null;
    const line = run.stationId
      ? await this.lines.findByStation(run.stationId)
      : null;

    if (!line) {
      return refused(
        runId,
        taskId,
        stationId,
        'not-at-the-station',
        'No line has the station that it worked at.',
      );
    }

    try {
      await this.dispatch.planned(run, line, RunId.of(this.ids.generate()));
    } catch (error) {
      if (error instanceof UnreplayableRunError) {
        return refused(runId, taskId, stationId, error.refusal, error.reason);
      }

      this.logger.warn(
        { err: error, runId },
        'A run could not be checked for replaying',
      );
      return refused(
        runId,
        taskId,
        stationId,
        'unchecked',
        'It could not be checked just now. Please try again later.',
      );
    }

    return { runId, taskId, stationId, refusal: null, reason: null };
  }
}

const refused = (
  runId: string,
  taskId: string | null,
  stationId: string | null,
  refusal: ReplayRefusalCode,
  reason: string,
): Replayability => ({ runId, taskId, stationId, refusal, reason });
