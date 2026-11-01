import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TRACE_PARENT_VAR } from '@work/application/contracts/run-spec.contract';
import type { HarnessLaunchPort } from '@work/application/ports/harness-launch.port';
import type {
  SearchAgent,
  SearchAgentProblem,
  SearchDispatched,
  SearchDispatchPort,
  SearchOrder,
  UnclaimedCancellation,
} from '@work/application/ports/search-dispatch.port';
import type { TraceParentPort } from '@work/application/ports/trace-parent.port';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { RunAlreadyExistsError } from '@work/domain/exceptions/run-already-exists.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { SEARCH_PRIORITY } from '@work/domain/services/search-priority';
import { EFFORTS, Effort } from '@work/domain/value-objects/effort.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { SearchId } from '@work/domain/value-objects/search-id.vo';
import { SearchIteration } from '@work/domain/value-objects/search-iteration.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';

const QUEUED: SearchDispatched = { outcome: 'queued' };

const STOPPED = 'Search stopped before a runner claimed the run.';

const LEFT_UNCLAIMED =
  'No runner claimed the run in time. Its search cancelled it.';

const ENDED: UnclaimedCancellation = { outcome: 'ended' };

const CLAIMED: UnclaimedCancellation = { outcome: 'claimed' };

const MAX_MODEL = 60;

const unstartable = (reason: string): SearchDispatched => ({
  outcome: 'unstartable',
  reason,
});

const succeeds = (made: () => unknown): boolean => {
  try {
    made();
    return true;
  } catch {
    return false;
  }
};

export class DispatchSearch implements SearchDispatchPort {
  constructor(
    private readonly runs: RunRepository,
    private readonly lines: LineRepository,
    private readonly launch: HarnessLaunchPort,
    private readonly tracing: TraceParentPort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  problemOf(agent: SearchAgent): SearchAgentProblem | null {
    const known = this.launch.catalogue().map((each) => each.id);

    if (!known.includes(agent.harness)) {
      return {
        field: 'harness',
        reason: `Harness ${agent.harness} is not one that a runner can start. Harnesses: ${known.join(', ')}`,
      };
    }
    const { model, effort } = agent;

    if (model !== null && !succeeds(() => HarnessModel.of(model))) {
      return {
        field: 'model',
        reason: `Model must be 1 to ${MAX_MODEL} characters, or empty.`,
      };
    }
    if (effort !== null && !succeeds(() => Effort.of(effort))) {
      return {
        field: 'effort',
        reason: `Effort must be one of ${EFFORTS.join(', ')}, or empty.`,
      };
    }

    return null;
  }

  async enqueue(order: SearchOrder): Promise<SearchDispatched> {
    try {
      return await this.enqueuedOnce(order);
    } catch (error) {
      if (error instanceof RunAlreadyExistsError) {
        return this.enqueuedOnce(order);
      }
      throw error;
    }
  }

  cancel(runId: string): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const run = await this.runs.findById(RunId.of(runId));

      if (!run?.isSearch || run.hasEnded) {
        return;
      }

      const changed =
        run.state === 'queued'
          ? run.cancelQueued(STOPPED)
          : run.cancel(this.clock.now());

      if (changed !== run) {
        await this.runs.save(changed);
      }
    });
  }

  cancelUnclaimed(runId: string): Promise<UnclaimedCancellation> {
    return this.transaction.inTransaction(async () => {
      const run = await this.runs.findById(RunId.of(runId));

      if (!run?.isSearch || run.hasEnded) {
        return ENDED;
      }
      if (run.state !== 'queued') {
        return CLAIMED;
      }

      await this.runs.save(run.cancelQueued(LEFT_UNCLAIMED));

      return { outcome: 'cancelled', started: run.attempt > 1 } as const;
    });
  }

  private enqueuedOnce(order: SearchOrder): Promise<SearchDispatched> {
    return this.transaction.inTransaction(async () => {
      const id = RunId.of(order.id);
      const searchId = SearchId.of(order.searchId);
      const iteration = SearchIteration.of(order.iteration);

      if (await this.alreadyQueued(id, searchId, iteration)) {
        return QUEUED;
      }

      const stationId = StationId.of(order.stationId);
      const line = await this.lines.find(LineId.of(order.lineId));

      if (
        !line ||
        line.isDeleted ||
        !line.stationAt(stationId)?.isAgentStation
      ) {
        return unstartable('the line no longer has the station it searches');
      }

      const harness = HarnessId.of(order.agent.harness);
      const command = this.launch.commandFor(harness, {
        model: order.agent.model ? HarnessModel.of(order.agent.model) : null,
        effort: order.agent.effort ? Effort.of(order.agent.effort) : null,
      });

      if (!command) {
        return unstartable(
          `no runner can start ${harness.value}, the harness it searches with`,
        );
      }

      await this.runs.add(
        Run.enqueue({
          id,
          workspaceId: line.workspaceId,
          harness,
          priority: SEARCH_PRIORITY,
          subject: RunSubject.search(
            searchId,
            iteration,
            stationId,
            line.teamId,
          ),
          placement: line.placementOf(stationId),
          spec: RunSpec.of({
            command: command.started({
              [TRACE_PARENT_VAR]: this.tracing.forSearch(searchId, id),
            }),
            briefing: order.briefing,
            handover: { options: [], noteLimit: 0 },
            resume: { key: `search-${id.value}` },
            search: {},
          }),
        }),
      );

      return QUEUED;
    });
  }

  private async alreadyQueued(
    id: RunId,
    searchId: SearchId,
    iteration: SearchIteration,
  ): Promise<boolean> {
    const queued = await this.runs.findById(id);

    if (!queued) {
      return false;
    }

    const subject = queued.subject;

    if (
      !subject?.searchId?.equals(searchId) ||
      !subject.iteration?.equals(iteration)
    ) {
      throw new InconsistentStateError(
        'run',
        `${id.value} is already a run of something other than iteration ${iteration.value} of search ${searchId.value}`,
      );
    }

    return true;
  }
}
