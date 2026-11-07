import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import {
  type RunId,
  RunId as RunIdOf,
} from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type {
  RunFacts as RunFactsDto,
  RunFactsPort,
} from '@work/application/ports/run-facts.port';
import type {
  LeasedRun,
  RunLeasesPort,
} from '@work/application/ports/run-leases.port';
import type {
  RunProgressFacts,
  RunProgressPort,
} from '@work/application/ports/run-progress.port';
import type {
  RunTurnsPort,
  TurnFacts,
  TurnsCursor,
} from '@work/application/ports/run-turns.port';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import { UnknownRunError } from '@work/domain/exceptions/unknown-run.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { WorkspaceArchiveRepository } from '@work/domain/repositories/workspace-archive.repository';
import { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';
import { RequesterOwner } from '@work/domain/value-objects/run-requester.vo';
import type { RunTurnState } from '@work/domain/value-objects/run-turn.vo';
import type { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';

const factsOf = (
  run: Run,
  archiveStored: (archive: WorkspaceArchiveId) => boolean,
): RunFactsDto => {
  const startedFrom = run.startedFrom;

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
    requester: run.requester.parts,
    policy: run.policy.parts,
    team: run.team,
    checkouts: run.spec.checkoutFolders,
    check: run.spec.check,
    setups: run.spec.checkoutSetups,
    placement: run.placement,
    queuedAt: queuedAtOf(run),
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    started: run.hasStarted,
    askedAPerson: run.askedAPerson,
    failed: run.outcome?.failed ?? false,
    exitCode: run.outcome?.exitCode ?? null,
    image: run.ranIn?.value ?? null,
    startedFrom: startedFrom && {
      archiveId: startedFrom.archive?.value ?? null,
      archiveStored: startedFrom.archive
        ? archiveStored(startedFrom.archive)
        : false,
      at: startedFrom.at,
      checkouts: startedFrom.checkouts.map((each) => each.parts),
    },
  };
};

const queuedAtOf = (run: Run): Date => {
  if (!run.queuedAt) {
    throw new InconsistentStateError(
      'run',
      `was read before it was queued (${run.id.value})`,
    );
  }

  return run.queuedAt;
};

const progressOf = (run: Run): RunProgressFacts => ({
  runId: run.id,
  state: run.state,
  stopRequested: run.stopRequested,
  turn: run.turn?.state ?? null,
  suspendedAt: run.turn?.suspendedAt ?? null,
  queuedAt: queuedAtOf(run),
});

const leasedOf = (
  run: Run,
  runner: RunnerId,
  stored: ReadonlySet<string>,
): LeasedRun => {
  const { manifest, catalog } = run.spec.value;

  return {
    ...factsOf(run, (archive) => stored.has(archive.value)),
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

export class RunFacts
  implements RunFactsPort, RunLeasesPort, RunTurnsPort, RunProgressPort
{
  constructor(
    private readonly runs: RunRepository,
    private readonly archives: WorkspaceArchiveRepository,
  ) {}

  async of(runIds: readonly RunId[]): Promise<readonly RunFactsDto[]> {
    const found = await this.found(runIds);
    const stored = await this.storedArchives(found);

    return found.map((run) =>
      factsOf(run, (archive) => stored.has(archive.value)),
    );
  }

  async progressOf(
    runIds: readonly RunId[],
  ): Promise<readonly RunProgressFacts[]> {
    return (await this.found(runIds)).map(progressOf);
  }

  private async found(runIds: readonly RunId[]): Promise<readonly Run[]> {
    const found: Run[] = [];

    for (const each of new Set(runIds.map((id) => id.value))) {
      const run = await this.runs.findById(RunIdOf.of(each));

      if (run) {
        found.push(run);
      }
    }

    return found;
  }

  private async storedArchives(
    runs: readonly Run[],
  ): Promise<ReadonlySet<string>> {
    const started = runs.flatMap((run) =>
      run.startedFrom?.archive
        ? [{ archive: run.startedFrom.archive, workspaceId: run.workspaceId }]
        : [],
    );
    const stored = new Set<string>();

    for (const { archive, workspaceId } of started) {
      if ((await this.archives.find(archive))?.isAvailableIn(workspaceId)) {
        stored.add(archive.value);
      }
    }

    return stored;
  }

  async leasedBy(runId: RunId, runner: RunnerId): Promise<LeasedRun | null> {
    const run = await this.runs.findById(runId);

    return run?.isLeasedBy(runner)
      ? leasedOf(run, runner, await this.storedArchives([run]))
      : null;
  }

  async leaseOf(runId: RunId, runner: RunnerId): Promise<LeasedRun> {
    const run = await this.lookedUp(runId);

    run.assertLeasedBy(runner);

    return leasedOf(run, runner, await this.storedArchives([run]));
  }

  async assertStillOn(
    runId: RunId,
    attempt: number,
    runner: RunnerId,
  ): Promise<void> {
    const run = await this.lookedUp(runId);

    run.assertStillOn(RunAttempt.of(runId, attempt), runner);
  }

  async turnOf(runId: RunId, attempt: number): Promise<TurnFacts | null> {
    const run = await this.runs.findById(runId);

    return run?.turnAt(attempt) ? turnFactsOf(run) : null;
  }

  async olderThan(
    owner: string,
    turn: RunTurnState,
    before: Date,
    after: TurnsCursor | null,
    max: number,
  ): Promise<readonly TurnFacts[]> {
    const runs = await this.runs.turnsSuspendedBefore(
      RequesterOwner.of(owner),
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

  private async lookedUp(runId: RunId): Promise<Run> {
    const run = await this.runs.findById(runId);

    if (!run) {
      throw new UnknownRunError(`Run ${runId.value} not found.`);
    }

    return run;
  }
}
