import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type {
  RunFacts as RunFactsDto,
  RunFactsPort,
  RunSubjectFacts,
} from '@work/application/ports/run-facts.port';
import type {
  LeasedRun,
  RunLeasesPort,
} from '@work/application/ports/run-leases.port';
import type {
  RunTurnsPort,
  TurnFacts,
  TurnsCursor,
} from '@work/application/ports/run-turns.port';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import { UnknownRunError } from '@work/domain/exceptions/unknown-run.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';
import type { RunTurnState } from '@work/domain/value-objects/run-turn.vo';

const subjectOf = (run: Run): RunSubjectFacts | null =>
  run.subject?.match<RunSubjectFacts>({
    task: (taskId, stationId, revision) => ({
      kind: 'task',
      taskId,
      stationId,
      revision: revision.value,
    }),
    chat: (chatId) => ({ kind: 'chat', chatId: chatId.value }),
    replay: (replayOf, taskId, stationId, teamId) => ({
      kind: 'replay',
      replayOf,
      taskId,
      stationId,
      teamId,
    }),
    search: (searchId, iteration, stationId, teamId) => ({
      kind: 'search',
      searchId: searchId.value,
      iteration: iteration.value,
      stationId,
      teamId,
    }),
  }) ?? null;

const factsOf = (run: Run): RunFactsDto => {
  const requester = run.requester;

  return {
    runId: run.id,
    workspaceId: run.workspaceId,
    state: run.state,
    ended: run.hasEnded,
    attempt: run.attempt,
    stopRequested: run.stopRequested,
    turn: run.turn?.state ?? null,
    suspendedAt: run.turn?.suspendedAt ?? null,
    claimedBy: run.claimedBy,
    harness: run.harness,
    requester: {
      owner: requester.owner.value,
      kind: requester.kind,
      id: requester.id,
      token: requester.token,
      team: requester.team?.value ?? null,
    },
    policy: run.policy.parts,
    team: run.team,
    subject: subjectOf(run),
    checkouts: run.spec.checkoutFolders,
  };
};

const leasedOf = (run: Run, runner: RunnerId): LeasedRun => {
  const { manifest, catalog } = run.spec.value;

  return {
    ...factsOf(run),
    claimedBy: runner,
    manifest: (manifest ?? []).map((each) => each.name),
    pins: catalog ?? [],
  };
};

const turnFactsOf = (run: Run): TurnFacts | null => {
  const turn = run.turnAt(run.attempt);

  return turn && run.outcome
    ? {
        runId: run.id,
        workspaceId: run.workspaceId,
        attempt: run.attempt,
        turn: turn.state,
        outcome: run.outcome,
        handover: turn.report.handover,
        session: turn.report.session,
        reportedBy: turn.reportedBy,
        suspendedAt: turn.suspendedAt,
        stopRequested: run.stopRequested,
      }
    : null;
};

export class RunFacts implements RunFactsPort, RunLeasesPort, RunTurnsPort {
  constructor(private readonly runs: RunRepository) {}

  async of(runIds: readonly RunId[]): Promise<readonly RunFactsDto[]> {
    const found = await Promise.all(
      runIds.map((each) => this.runs.findById(each)),
    );

    return found.flatMap((run) => (run ? [factsOf(run)] : []));
  }

  async leasedBy(runId: RunId, runner: RunnerId): Promise<LeasedRun | null> {
    const run = await this.runs.findById(runId);

    return run?.isLeasedBy(runner) ? leasedOf(run, runner) : null;
  }

  async leaseOf(runId: RunId, runner: RunnerId): Promise<LeasedRun> {
    const run = await this.found(runId);

    run.assertLeasedBy(runner);

    return leasedOf(run, runner);
  }

  async assertStillOn(
    runId: RunId,
    attempt: number,
    runner: RunnerId,
  ): Promise<void> {
    const run = await this.found(runId);

    run.assertStillOn(RunAttempt.of(runId, attempt), runner);
  }

  async turnOf(runId: RunId, attempt: number): Promise<TurnFacts | null> {
    const run = await this.runs.findById(runId);

    return run?.turnAt(attempt) ? turnFactsOf(run) : null;
  }

  async ofTasksOlderThan(
    turn: RunTurnState,
    before: Date,
    after: TurnsCursor | null,
    max: number,
  ): Promise<readonly TurnFacts[]> {
    const runs = await this.runs.turnsOfTasksSuspendedBefore(
      turn,
      before,
      after && { suspendedAt: after.suspendedAt, id: after.runId },
      max,
    );

    return runs.flatMap((run) => {
      const facts = turnFactsOf(run);

      return facts ? [facts] : [];
    });
  }

  private async found(runId: RunId): Promise<Run> {
    const run = await this.runs.findById(runId);

    if (!run) {
      throw new UnknownRunError(`Run ${runId.value} not found.`);
    }

    return run;
  }
}
