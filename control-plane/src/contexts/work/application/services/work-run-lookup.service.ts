import type {
  JournalStep,
  NumberedJournalStep,
} from '@runs/application/contracts/run-journal.contract';
import type { RunFactsPort } from '@runs/application/ports/run-facts.port';
import type { RunJournalReadingsPort } from '@runs/application/ports/run-journal-readings.port';
import type { RunLeasesPort } from '@runs/application/ports/run-leases.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { firstOf } from '@shared-kernel/domain/item-at';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { RunReadingMapper } from '@work/application/mappers/run-reading.mapper';
import type {
  DispatchedFor,
  DispatchedRun,
  DispatchedRunsPort,
} from '@work/application/ports/dispatched-runs.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import type {
  FilesUnder,
  LeasedRunLookup,
  ReasonedStep,
  RunContext,
  RunLocation,
  RunLookup,
  RunReasoning,
  WorkRunLookupPort,
} from '@work/application/ports/work-run-lookup.port';
import { referencesUnder } from '@work/application/services/journal-references';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { reasoningIn } from '@work/domain/services/run-reasoning';
import { repositoriesForTask } from '@work/domain/services/task-checkouts';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';

interface RunTeam {
  readonly runId: RunId;
  readonly team: TeamId | null;
}

const stepsOf = (numbered: readonly NumberedJournalStep[]): JournalStep[] =>
  numbered.map((each) => each.step);

const reasoned = ({ step, index }: NumberedJournalStep): ReasonedStep[] => {
  const reasoning = reasoningIn({
    ...step,
    kind: RunReadingMapper.stepKind(step.kind),
  });
  return reasoning ? [{ index, ...reasoning }] : [];
};

const stationOf = (dispatched: DispatchedRun | null): StationId | null =>
  dispatched && dispatched.for.kind !== 'chat'
    ? dispatched.for.stationId
    : null;

const taskOf = (dispatched: DispatchedRun | null) =>
  dispatched?.for.kind === 'task' ? dispatched.for.taskId : null;

const asOfTrial = (dispatched: DispatchedRun | null): Date | null => {
  if (dispatched?.for.kind !== 'trial') {
    return null;
  }

  if (!dispatched.for.asOf) {
    throw new InconsistentStateError(
      'dispatch',
      `tries a run that never said where it started (${dispatched.runId.value})`,
    );
  }

  return dispatched.for.asOf;
};

export class WorkRunLookup implements WorkRunLookupPort {
  constructor(
    private readonly facts: RunFactsPort,
    private readonly leases: RunLeasesPort,
    private readonly dispatches: DispatchedRunsPort,
    private readonly tasks: TaskRepository,
    private readonly chats: ChatRepository,
    private readonly lines: LineMapsPort,
    private readonly journals: RunJournalReaderPort,
    private readonly readings: RunJournalReadingsPort,
  ) {}

  async run(runId: RunId): Promise<RunLookup | null> {
    const run = firstOf(await this.facts.of([runId]));

    if (!run) {
      return null;
    }

    const dispatched = await this.dispatches.of(runId);
    const stationId = stationOf(dispatched);
    const line = stationId ? await this.lines.findByStation(stationId) : null;
    const station = stationId ? line?.stationAt(stationId) : null;

    return {
      id: run.runId,
      harness: run.harness.value,
      workspaceId: run.workspaceId,
      taskId: taskOf(dispatched),
      check: run.check,
      setups: run.setups,
      placement: run.placement,
      decisions: station?.decisions ?? false,
      memories: station?.memories ?? false,
      briefedWith: dispatched?.briefedMemories ?? BriefedMemories.none().value,
      working: run.working,
      attempt: run.attempt,
      orderedAt: dispatched?.orderedAt ?? null,
      trial: dispatched?.for.kind === 'trial',
      isolated: !run.policy.actsBeyondItself,
      checkouts: run.checkouts.length,
    };
  }

  async locationOf(runId: RunId): Promise<RunLocation | null> {
    const run = firstOf(await this.facts.of([runId]));
    const dispatched =
      run !== undefined ? await this.dispatches.of(runId) : null;
    const stationId = stationOf(dispatched);
    const line = stationId ? await this.lines.findByStation(stationId) : null;
    const station = stationId ? line?.stationAt(stationId) : null;

    return run?.team && dispatched && line?.teamId.equals(run.team) && station
      ? {
          teamId: run.team,
          lineId: line.id.value,
          lineName: line.name.value,
          stationId: station.id.value,
          stationName: station.name.value,
          repositories: await this.repositoriesOn(dispatched.for, line),
        }
      : null;
  }

  async reasoning(
    runId: RunId,
    throughAttempt: number | null,
  ): Promise<RunReasoning | null> {
    const run = firstOf(await this.facts.of([runId]));
    const steps =
      run !== undefined
        ? this.readings.stepsThrough(
            await this.journals.attemptsOfRun(runId),
            throughAttempt,
          )
        : null;

    return steps && { steps: steps.flatMap(reasoned) };
  }

  async leasedBy(
    runId: RunId,
    runner: RunnerId,
  ): Promise<LeasedRunLookup | null> {
    const leased = await this.leases.leasedBy(runId, runner);

    if (!leased) {
      return null;
    }

    const dispatched = await this.dispatches.of(runId);
    const runContext = await this.contextOf(leased, dispatched);

    return (
      runContext && {
        id: leased.runId,
        workspaceId: leased.workspaceId,
        taskId: taskOf(dispatched),
        asOf: asOfTrial(dispatched),
        trial: dispatched?.for.kind === 'trial',
        isolated: !leased.policy.actsBeyondItself,
        ...runContext,
      }
    );
  }

  async contextOfRun(runId: RunId): Promise<RunContext | null> {
    const run = firstOf(await this.facts.of([runId]));

    return run !== undefined
      ? this.contextOf(run, await this.dispatches.of(runId))
      : null;
  }

  async filesReadUnder(
    runId: RunId,
    under: FilesUnder,
  ): Promise<readonly string[] | null> {
    const steps = this.readings.stepsThrough(
      await this.journals.attemptsOfRun(runId),
      null,
    );

    return steps ? referencesUnder(stepsOf(steps), under) : null;
  }

  private async contextOf(
    run: RunTeam,
    dispatched: DispatchedRun | null,
  ): Promise<RunContext | null> {
    const team = run.team;

    if (!team) {
      return null;
    }

    if (!dispatched) {
      return { teamId: team, lineId: null, stationId: null, repositories: [] };
    }

    const subject = dispatched.for;

    if (subject.kind === 'chat') {
      const chat = await this.chats.find(subject.chatId);

      return (
        chat && {
          teamId: team,
          lineId: null,
          stationId: null,
          repositories: chat.repositories,
        }
      );
    }

    const line = await this.lines.findByStation(subject.stationId);

    if (subject.kind === 'trial') {
      return {
        teamId: team,
        lineId: line?.teamId.equals(team) ? line.id.value : null,
        stationId: line ? subject.stationId.value : null,
        repositories: subject.repositories,
      };
    }

    return (
      line && {
        teamId: team,
        lineId: line.id.value,
        stationId: subject.stationId.value,
        repositories: await this.repositoriesOn(subject, line),
      }
    );
  }

  private async repositoriesOn(
    subject: DispatchedFor,
    line: LineMap,
  ): Promise<readonly Repository[]> {
    const task =
      subject.kind === 'task' ? await this.tasks.find(subject.taskId) : null;

    return repositoriesForTask(task, line);
  }
}
