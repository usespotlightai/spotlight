import { reviseReplay } from '@replays/application/services/replay-revisions';
import type { ReplayRunDispatching } from '@replays/application/services/replay-run-dispatch.service';
import type { ReplayRunOwner } from '@replays/domain/aggregates/replay-run-decision.aggregate';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplayEntry } from '@replays/domain/entities/replay-entry.entity';
import { DispatchSlotTakenError } from '@replays/domain/exceptions/dispatch-slot-taken.error';
import { ReplayVersionConflictError } from '@replays/domain/exceptions/replay-version-conflict.error';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import { dispatchedInTurn } from '@replays/domain/services/replay-dispatch';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const ownerOf = (replay: Replay): ReplayRunOwner => ({
  workspaceId: replay.workspaceId,
  teamId: replay.teamId,
  replayId: replay.id,
});

export class DispatchReplayRuns implements PendingJobsPort {
  readonly name = 'Dispatching replay runs';

  constructor(
    private readonly replays: ReplayRepository,
    private readonly candidates: CandidateRepository,
    private readonly searches: SearchRepository,
    private readonly replayRuns: ReplayRunDispatching,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
    private readonly logger: LoggerPort,
  ) {}

  async processDue(): Promise<void> {
    for (const team of await this.replays.teamsDispatching()) {
      await this.reserveFor(team).catch((error: unknown) =>
        this.logger.warn(
          { err: error, teamId: team.value },
          'Replay runs could not be reserved',
        ),
      );
    }

    for (const replay of await this.replays.unconfirmed()) {
      for (const entry of replay.unconfirmed) {
        await this.resolve(replay, entry).catch((error: unknown) =>
          this.failed(replay, entry, error),
        );
      }
    }
  }

  private async reserveFor(team: TeamId): Promise<void> {
    const inProgress = await this.replays.inProgressOfTeam(team);
    const searches = await this.searches.findMany(
      inProgress.flatMap((each) => (each.searchId ? [each.searchId] : [])),
    );
    const changed = dispatchedInTurn(
      inProgress,
      () => RunId.of(this.ids.generate()),
      (searchId) =>
        searches.find((each) => each.id.equals(searchId) && each.isActive)
          ?.concurrency ?? 0,
    );

    for (const replay of changed) {
      try {
        await this.transaction.inTransaction(() => this.replays.save(replay));
      } catch (error) {
        if (
          !(error instanceof ReplayVersionConflictError) &&
          !(error instanceof DispatchSlotTakenError)
        ) {
          throw error;
        }

        this.logger.info(
          { replayId: replay.id.value, teamId: team.value },
          'A replay or its dispatch pool changed before its runs were reserved; the next turn tries again',
        );
      }
    }
  }

  private resolve(replay: Replay, entry: ReplayEntry): Promise<void> {
    if (!replay.isDispatching) {
      return this.cancel(replay, entry, false);
    }

    return entry.isExhausted
      ? this.cancel(replay, entry, true)
      : this.queue(replay, entry);
  }

  private async queue(replay: Replay, entry: ReplayEntry): Promise<void> {
    const run = entry.run;
    const candidate = await this.candidates.find(replay.candidateId);

    if (!run) {
      return;
    }

    if (!candidate) {
      return this.cancel(replay, entry, false, (fresh, now) =>
        fresh.unreplayable(run, 'candidate-unfit', now),
      );
    }

    const queued = await this.replayRuns.dispatch({
      run,
      owner: ownerOf(replay),
      original: entry.original,
      lineId: replay.station.lineId,
      stationId: replay.station.stationId,
      block: candidate.block,
      line: candidate.line,
      answer: replay.answerTo(entry.original),
    });

    const updated = await this.changed(replay, (fresh, now) =>
      queued.queued
        ? fresh.confirm(run, queued.fingerprint, now)
        : fresh.unreplayable(run, queued.unreplayableReason, now),
    );

    if (queued.queued && updated && !updated.isDispatching) {
      await this.replayRuns.cancel(run, ownerOf(replay), false);
    }
  }

  private async cancel(
    replay: Replay,
    entry: ReplayEntry,
    leaveRunAsIs: boolean,
    neverQueued?: (fresh: Replay, now: Date) => Replay,
  ): Promise<void> {
    const run = entry.run;

    if (!run) {
      return;
    }

    const cancelled = await this.replayRuns.cancel(
      run,
      ownerOf(replay),
      leaveRunAsIs,
    );

    await this.changed(replay, (fresh, now) => {
      if (cancelled.wasQueued) {
        return fresh.confirm(run, cancelled.fingerprint, now);
      }
      if (neverQueued) {
        return neverQueued(fresh, now);
      }

      return leaveRunAsIs ? fresh.exhaust(run, now) : fresh.cancel(run, now);
    });
  }

  private async failed(
    replay: Replay,
    entry: ReplayEntry,
    error: unknown,
  ): Promise<void> {
    if (error instanceof ReplayVersionConflictError) {
      this.logger.info(
        { replayId: replay.id.value, runId: entry.run?.value },
        'A replay changed before its run could be confirmed',
      );
      return;
    }

    this.logger.warn(
      {
        err: error,
        replayId: replay.id.value,
        runId: entry.run?.value,
        attempts: entry.queueAttempts + 1,
      },
      'A replay run could not be queued',
    );

    const run = entry.run;

    if (run) {
      await this.changed(replay, (fresh, now) =>
        fresh.recordQueueFailure(run, now),
      ).catch((again: unknown) =>
        this.logger.warn(
          { err: again, replayId: replay.id.value },
          'A failed replay run could not be counted',
        ),
      );
    }
  }

  private changed(
    replay: Replay,
    change: (fresh: Replay, now: Date) => Replay,
  ): Promise<Replay | null> {
    return reviseReplay(
      this.replays,
      this.transaction,
      () => this.replays.find(replay.id),
      (fresh) => change(fresh, this.clock.now()),
    );
  }
}
