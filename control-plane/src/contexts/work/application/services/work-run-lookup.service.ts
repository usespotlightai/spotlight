import type {
  JournalStep,
  RunChanges,
  RunJournal,
} from '@runs/application/contracts/run-journal.contract';
import { RunReading } from '@runs/application/contracts/run-reading.contract';
import type { RunFactsPort } from '@runs/application/ports/run-facts.port';
import type { RunLeasesPort } from '@runs/application/ports/run-leases.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type {
  DispatchedFor,
  DispatchedRun,
  DispatchedRunsPort,
} from '@work/application/ports/dispatched-runs.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import type {
  ChangedFile,
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
import { distinctFiles } from '@work/application/services/touched-files';
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

const changesIn = (
  journal: RunJournal,
  checkouts: readonly string[],
): RunChanges => ({
  runId: journal.runId,
  checkouts,
  paths: journal.steps.flatMap((step) =>
    step.change?.path ? [step.change.path] : [],
  ),
});

const reasoned = (step: JournalStep, index: number): ReasonedStep[] => {
  const reasoning = reasoningIn(step);
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
  ) {}

  async run(runId: RunId): Promise<RunLookup | null> {
    const [run] = await this.facts.of([runId]);

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
      ended: run.ended,
      completed: run.state === 'completed',
      trial: dispatched?.for.kind === 'trial',
      isolated: !run.policy.actsBeyondItself,
      checkouts: run.checkouts.length,
    };
  }

  async locationOf(runId: RunId): Promise<RunLocation | null> {
    const [run] = await this.facts.of([runId]);
    const dispatched = run ? await this.dispatches.of(runId) : null;
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

  async reasoning(runId: RunId): Promise<RunReasoning | null> {
    const [run] = await this.facts.of([runId]);
    const journal = run ? await this.journals.ofRun(runId) : null;

    if (!run || !journal) {
      return null;
    }

    const taskId = taskOf(await this.dispatches.of(runId));
    const changes = taskId
      ? await this.journals.changesOfTask(taskId)
      : [changesIn(journal, run.checkouts)];

    return {
      steps: journal.steps.flatMap(reasoned),
      changed: [...new Set(changes.flatMap(RunReading.workspacePathsIn))],
    };
  }

  async changedBy(runId: RunId): Promise<readonly ChangedFile[] | null> {
    const [run] = await this.facts.of([runId]);
    const journal = run ? await this.journals.ofRun(runId) : null;

    if (!run || !journal) {
      return null;
    }

    const dispatched = await this.dispatches.of(runId);
    const stationId = stationOf(dispatched);
    const line = stationId ? await this.lines.findByStation(stationId) : null;
    const repositories =
      dispatched && line ? await this.repositoriesOn(dispatched.for, line) : [];

    return distinctFiles(
      RunReading.filesChangedIn(
        changesIn(journal, run.checkouts),
        repositories,
      ),
    );
  }

  async wasClaimedBy(runId: RunId, runner: RunnerId): Promise<boolean> {
    const [run] = await this.facts.of([runId]);

    return run?.claimedBy?.equals(runner) ?? false;
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
    const [run] = await this.facts.of([runId]);

    return run ? this.contextOf(run, await this.dispatches.of(runId)) : null;
  }

  async filesReadUnder(
    runId: RunId,
    under: FilesUnder,
  ): Promise<readonly string[] | null> {
    const journal = await this.journals.ofRun(runId);

    return journal ? referencesUnder(journal, under) : null;
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
