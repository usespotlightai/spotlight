import type { RunArchivesPort } from '@runs/application/ports/run-archives.port';
import type { RunFactsReaderPort } from '@runs/application/ports/run-facts-reader.port';
import type {
  RunFacts as RunFactsDto,
  RunFactsPort,
  RunTurnFact,
} from '@runs/application/ports/run-facts.port';
import type {
  LeasedRunFacts,
  RunLeasesPort,
} from '@runs/application/ports/run-leases.port';
import type {
  RunProgressFacts,
  RunProgressPort,
} from '@runs/application/ports/run-progress.port';
import type {
  RunTurnsPort,
  TurnFacts,
  TurnsCursor,
} from '@runs/application/ports/run-turns.port';
import type { TeamRunsPort } from '@runs/application/ports/team-runs.port';
import { runOutcomeText } from '@runs/application/rendering/run-outcome.text';
import type { Run } from '@runs/domain/aggregates/run.aggregate';
import { UnknownRunError } from '@runs/domain/exceptions/unknown-run.error';
import { RunAttempt } from '@runs/domain/value-objects/run-attempt.vo';
import { RequesterOwner } from '@runs/domain/value-objects/run-requester.vo';
import {
  isWorking,
  resumable,
  progressOf as runProgressOf,
} from '@runs/domain/value-objects/run-state';
import {
  currentWait,
  type QueuedRunWait,
} from '@runs/domain/value-objects/run-waiting';
import type { WorkingCopyArchiveId } from '@runs/domain/value-objects/working-copy-archive-id.vo';
import { firstOf } from '@shared-kernel/domain/item-at';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const factsOf = (
  run: Run,
  archiveStored: (archive: WorkingCopyArchiveId) => boolean,
  wait: QueuedRunWait | null,
): RunFactsDto => {
  const startedFrom = run.startedFrom;

  return {
    runId: run.id,
    workspaceId: run.workspaceId,
    state: run.state,
    ended: run.hasEnded,
    attempt: run.attempt.number,
    stopRequested: run.stopRequested,
    turn: run.turn?.state ?? null,
    suspendedAt: run.turn?.suspendedAt ?? null,
    ...progressFactsOf(run),
    claimedBy: run.claimedBy,
    harness: run.harness,
    requester: run.requester.parts,
    policy: run.policy.parts,
    team: run.team,
    checkouts: run.spec.checkoutFolders,
    check: run.spec.check,
    setups: run.spec.checkoutSetups,
    placement: run.placement,
    queuedAt: run.queuedAt,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    spent: {
      queuedMs: run.spent.queuedMs,
      runningMs: run.spent.runningMs,
      firstStartedAt: run.spent.firstStartedAt,
    },
    started: run.hasStarted,
    askedAPerson: run.askedAPerson,
    failed: run.outcome?.failed ?? false,
    exitCode: run.outcome?.exitCode.value ?? null,
    image: run.ranIn?.value ?? null,
    ranOn: run.ranOn?.parts ?? null,
    waiting: currentWait(
      {
        state: run.state,
        queuedAt: run.queuedAt,
        reserved: run.reservation !== null,
      },
      wait,
    ),
    startedFrom: startedFrom && {
      archiveId: startedFrom.archive?.value ?? null,
      archiveStored: startedFrom.archive
        ? archiveStored(startedFrom.archive)
        : false,
      at: startedFrom.at,
      checkouts: startedFrom.checkouts.map((each) => each.parts),
    },
    endHeads: run.endHeads.map((each) => each.parts),
  };
};

const progressFactsOf = (run: Run) => {
  const turn = run.turn?.state ?? null;

  return {
    progress: runProgressOf({
      state: run.state,
      stopRequested: run.stopRequested,
      turn,
    }),
    resumable: resumable(run.state, run.stopRequested, turn),
    working: isWorking(run.state, run.stopRequested),
  };
};

const progressOf = (run: Run): RunProgressFacts => ({
  runId: run.id,
  state: run.state,
  stopRequested: run.stopRequested,
  turn: run.turn?.state ?? null,
  ...progressFactsOf(run),
  suspendedAt: run.turn?.suspendedAt ?? null,
  queuedAt: run.queuedAt,
});

const leasedOf = (
  run: Run,
  runner: RunnerId,
  stored: ReadonlySet<string>,
): LeasedRunFacts => {
  const { manifest, catalog } = run.spec.value;

  return {
    ...factsOf(run, (archive) => stored.has(archive.value), null),
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
        attempt: run.attempt.number,
        turn: turn.state,
        outcome: {
          exitCode: run.outcome.exitCode.value,
          failure: run.outcome.failure?.code ?? null,
          message: runOutcomeText(run.outcome),
          stopped: run.outcome.stopped,
        },
        handover: turn.report.handover && {
          next: turn.report.handover.next,
          note: turn.report.handover.note,
          suggest: turn.report.handover.suggest,
          files: turn.report.handover.attachments.map((each) => ({
            id: each.id,
            name: each.name,
            contentType: each.contentType,
            size: each.size,
          })),
        },
        session: turn.report.session?.value ?? null,
        reportedBy: turn.reportedBy,
        suspendedAt: turn.suspendedAt,
        stopRequested: run.stopRequested,
      }
    : null;
};

export class RunReadModel
  implements
    RunFactsPort,
    RunLeasesPort,
    RunTurnsPort,
    RunProgressPort,
    RunArchivesPort,
    TeamRunsPort
{
  constructor(private readonly reader: RunFactsReaderPort) {}

  async of(runIds: readonly RunId[]): Promise<readonly RunFactsDto[]> {
    const found = await this.found(runIds);
    const [stored, waits] = await Promise.all([
      this.storedArchives(found),
      this.waitsOf(found),
    ]);

    return found.map((run) =>
      factsOf(
        run,
        (archive) => stored.has(archive.value),
        waits.get(run.id.value) ?? null,
      ),
    );
  }

  // Only a queued run waits, so the others need no read.
  private async waitsOf(
    runs: readonly Run[],
  ): Promise<ReadonlyMap<string, QueuedRunWait>> {
    const queued = runs.filter((run) => run.state === 'queued');

    if (queued.length === 0) {
      return new Map();
    }

    return new Map(
      (await this.reader.waits(queued.map((run) => run.id))).map((each) => [
        each.runId.value,
        each,
      ]),
    );
  }

  newestCompletedOfTeam(team: TeamId, owner: string): Promise<RunId | null> {
    return this.reader.newestCompletedOfTeam(team, owner);
  }

  async restorableFor(runId: RunId): Promise<string | null> {
    const run = await this.one(runId);

    if (!run) {
      return null;
    }

    const newest = await this.reader.newestArchiveOf(run.id);

    if (newest?.isAvailableIn(run.workspaceId) === true) {
      return newest.id.value;
    }

    const startedFrom = run.startedFrom?.archive;

    return startedFrom &&
      (await this.storedArchives([run])).has(startedFrom.value)
      ? startedFrom.value
      : null;
  }

  async progressOf(
    runIds: readonly RunId[],
  ): Promise<readonly RunProgressFacts[]> {
    return (await this.found(runIds)).map(progressOf);
  }

  private async found(runIds: readonly RunId[]): Promise<readonly Run[]> {
    const byId = new Map(
      (await this.reader.runs(runIds)).map((run) => [run.id.value, run]),
    );

    return [...new Set(runIds.map((id) => id.value))].flatMap((id) => {
      const run = byId.get(id);

      return run ? [run] : [];
    });
  }

  private async storedArchives(
    runs: readonly Run[],
  ): Promise<ReadonlySet<string>> {
    const started = runs.flatMap((run) =>
      run.startedFrom?.archive
        ? [{ archive: run.startedFrom.archive, workspaceId: run.workspaceId }]
        : [],
    );
    const archives = new Map(
      (await this.reader.archives(started.map((each) => each.archive))).map(
        (archive) => [archive.id.value, archive],
      ),
    );

    return new Set(
      started.flatMap(({ archive, workspaceId }) =>
        archives.get(archive.value)?.isAvailableIn(workspaceId) === true
          ? [archive.value]
          : [],
      ),
    );
  }

  async leasedBy(
    runId: RunId,
    runner: RunnerId,
  ): Promise<LeasedRunFacts | null> {
    const run = await this.one(runId);

    return run?.isLeasedBy(runner) === true
      ? leasedOf(run, runner, await this.storedArchives([run]))
      : null;
  }

  async leaseOf(runId: RunId, runner: RunnerId): Promise<LeasedRunFacts> {
    const run = await this.lookedUp(runId);

    run.assertLeasedBy(runner);

    return leasedOf(run, runner, await this.storedArchives([run]));
  }

  async isStillOn(
    runId: RunId,
    attempt: number,
    runner: RunnerId,
  ): Promise<boolean> {
    const run = await this.one(runId);

    return run?.isStillOn(RunAttempt.of(runId, attempt), runner) ?? false;
  }

  async claimedBy(runId: RunId, runner: RunnerId): Promise<boolean> {
    return (await this.one(runId))?.wasClaimedBy(runner) ?? false;
  }

  async turnOf(runId: RunId, attempt: number): Promise<TurnFacts | null> {
    const run = await this.one(runId);
    const numbered = run?.attemptNumbered(attempt);

    return run && numbered && run.turnAt(numbered) ? turnFactsOf(run) : null;
  }

  async olderThan(
    owner: string,
    turn: RunTurnFact,
    before: Date,
    after: TurnsCursor | null,
    max: number,
  ): Promise<readonly TurnFacts[]> {
    const runs = await this.reader.turnsSuspendedBefore(
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

  private async one(runId: RunId): Promise<Run | null> {
    return firstOf(await this.reader.runs([runId])) ?? null;
  }

  private async lookedUp(runId: RunId): Promise<Run> {
    const run = await this.one(runId);

    if (!run) {
      throw new UnknownRunError(`Run ${runId.value} not found.`);
    }

    return run;
  }
}
