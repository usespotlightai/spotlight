import type { StartReplayCommand } from '@replays/application/commands/start-replay.command';
import type { ReplayStarted } from '@replays/application/dto/replay-outcomes.dto';
import type { LiveSnapshots } from '@replays/application/services/live-snapshots.service';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import type { SetStations } from '@replays/application/services/set-stations.service';
import type { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import { ReplaySetBaselineMovedError } from '@replays/domain/exceptions/replay-set-baseline-moved.error';
import { UnknownCandidateError } from '@replays/domain/exceptions/unknown-candidate.error';
import { UnknownReplaySetError } from '@replays/domain/exceptions/unknown-replay-set.error';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import {
  needsBaseline,
  standingBaselineFor,
} from '@replays/domain/services/baseline';
import type { ReplaysClearance } from '@replays/domain/services/replays-clearance';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

const LIVE = 'live';

export class StartReplayHandler
  implements CommandHandlerPort<StartReplayCommand, ReplayStarted>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly snapshots: LiveSnapshots,
    private readonly candidates: CandidateRepository,
    private readonly sets: ReplaySetRepository,
    private readonly replays: ReplayRepository,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
    private readonly stations: SetStations,
  ) {}

  async execute(command: StartReplayCommand): Promise<ReplayStarted> {
    try {
      const clearance = await this.access.clearance(
        command.teamId,
        command.actor.principal,
      );
      const seen = await this.access.setOn(clearance, command.setId);

      if (!clearance.mayPlan) {
        return forbiddenTo('plan');
      }

      const ceiling = Spend.ceiling(
        command.ceiling.amount,
        command.ceiling.currency,
      );

      await this.stations.stillThere(seen);

      const asked =
        command.candidate === LIVE
          ? null
          : await this.proposed(clearance, seen, command.candidate);
      const liveScoring = await this.snapshots.scoringOf(seen);
      const wantedBefore = needsBaseline(
        seen,
        await this.replays.ofSet(seen.id),
        liveScoring,
        command.repeats,
      );
      const live =
        !asked || wantedBefore ? await this.snapshots.taken(seen) : null;
      const candidate = asked ?? (live as Candidate);
      const id = ReplayId.of(this.ids.generate());
      const baselineId = ReplayId.of(this.ids.generate());

      const { asBaseline, wanted } = await this.keepingLive(
        live,
        asked === null,
        () =>
          this.transaction.run(async () => {
            const set = await this.sets.locked(seen.id);

            if (!set) {
              throw new UnknownReplaySetError(command.setId);
            }

            const setReplays = await this.replays.ofSet(set.id);
            const needed = needsBaseline(
              set,
              setReplays,
              liveScoring,
              command.repeats,
            );

            if (needed && asked && !live) {
              throw new ReplaySetBaselineMovedError(set.id.value);
            }

            if (asked && !(await this.candidates.lockedForUse(asked.id))) {
              throw new UnknownCandidateError(asked.id.value);
            }

            const asBaseline = needed && !asked;
            const wanting =
              needed && asked && live
                ? { id: baselineId, candidate: live }
                : null;

            await this.replays.add(
              Replay.started({
                id,
                set,
                candidate,
                baseline: asBaseline,
                ceiling,
                repeats: command.repeats,
                probe: command.probe,
                pairsWith:
                  asBaseline || command.probe
                    ? null
                    : (wanting?.id ??
                      standingBaselineFor(
                        set,
                        setReplays,
                        liveScoring,
                        command.repeats,
                      )?.id ??
                      null),
                at: this.clock.now(),
                by: Attribution.of(command.actor, set.workspaceId),
                wanting,
              }),
            );

            return { asBaseline, wanted: wanting !== null };
          }),
      );

      const spend = { amount: ceiling.amount, currency: ceiling.currency };

      return {
        outcome: 'started',
        id: id.value,
        ceiling: spend,
        baseline: asBaseline
          ? { id: id.value, ceiling: spend, status: 'started' }
          : wanted
            ? { id: baselineId.value, ceiling: spend, status: 'starting' }
            : null,
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }

  private async keepingLive<T extends { wanted: boolean }>(
    live: Candidate | null,
    replaysLive: boolean,
    start: () => Promise<T>,
  ): Promise<T> {
    let started: T;

    try {
      started = await start();
    } catch (error) {
      await this.snapshots.letGo(live);
      throw error;
    }

    if (!replaysLive && !started.wanted) {
      await this.snapshots.letGo(live);
    }

    return started;
  }

  private async proposed(
    clearance: ReplaysClearance,
    set: ReplaySet,
    candidateId: string,
  ): Promise<Candidate> {
    const candidate = await this.candidates.find(CandidateId.of(candidateId));

    if (
      !candidate ||
      !clearance.sees(candidate.station) ||
      !candidate.isFor(set.station.stationId)
    ) {
      throw new UnknownCandidateError(candidateId);
    }

    return candidate;
  }
}
