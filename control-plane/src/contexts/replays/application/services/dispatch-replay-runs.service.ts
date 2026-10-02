import type { WorkPort } from '@replays/application/ports/work.port';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import { dispatchedInTurn } from '@replays/domain/services/replay-dispatch';
import type { ReplayEntry } from '@replays/domain/value-objects/replay-entry.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { OwedWorkPort } from '@shared-kernel/application/ports/owed-work.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class DispatchReplayRuns implements OwedWorkPort {
  readonly name = 'Dispatching replay runs';

  constructor(
    private readonly replays: ReplayRepository,
    private readonly candidates: CandidateRepository,
    private readonly work: WorkPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
    private readonly logger: LoggerPort,
  ) {}

  async workDue(): Promise<void> {
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

  private reserveFor(team: TeamId): Promise<void> {
    return this.transaction.run(async () => {
      const changed = dispatchedInTurn(
        await this.replays.underwayOfTeamLocked(team),
        () => RunId.of(this.ids.generate()),
      );

      for (const replay of changed) {
        await this.replays.save(replay);
      }
    });
  }

  private resolve(replay: Replay, entry: ReplayEntry): Promise<void> {
    if (!replay.isDispatching) {
      return this.forgo(replay, entry, false);
    }

    return entry.isGivenUp
      ? this.forgo(replay, entry, true)
      : this.queue(replay, entry);
  }

  private async queue(replay: Replay, entry: ReplayEntry): Promise<void> {
    const run = entry.run;
    const candidate = await this.candidates.find(replay.candidateId);

    if (!run) {
      return;
    }

    if (!candidate) {
      return this.forgo(replay, entry, false, (fresh, now) =>
        fresh.refused(run, 'candidate-unfit', now),
      );
    }

    const queued = await this.work.dispatch({
      run,
      original: entry.original,
      workspaceId: replay.workspaceId,
      lineId: replay.station.lineId,
      stationId: replay.station.stationId,
      block: candidate.block,
    });

    const held = await this.changed(replay, (fresh, now) =>
      queued.queued
        ? fresh.confirmed(run, queued.fingerprint, now)
        : fresh.refused(run, queued.refusal, now),
    );

    if (queued.queued && held && !held.isDispatching) {
      await this.work.forgo(run, false);
    }
  }

  private async forgo(
    replay: Replay,
    entry: ReplayEntry,
    keep: boolean,
    neverQueued?: (fresh: Replay, now: Date) => Replay,
  ): Promise<void> {
    const run = entry.run;

    if (!run) {
      return;
    }

    const forgone = await this.work.forgo(run, keep);

    await this.changed(replay, (fresh, now) => {
      if (forgone.queued) {
        return fresh.confirmed(run, forgone.fingerprint, now);
      }
      if (neverQueued) {
        return neverQueued(fresh, now);
      }

      return keep ? fresh.gaveUp(run, now) : fresh.forgone(run, now);
    });
  }

  private async failed(
    replay: Replay,
    entry: ReplayEntry,
    error: unknown,
  ): Promise<void> {
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
        fresh.queueFailed(run, now),
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
    return this.transaction.run(async () => {
      const fresh = await this.replays.find(replay.id);

      if (!fresh) {
        return null;
      }

      const changed = change(fresh, this.clock.now());

      if (changed !== fresh) {
        await this.replays.save(changed);
      }

      return changed;
    });
  }
}
