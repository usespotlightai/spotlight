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
  currentBaselineFor,
  needsBaseline,
} from '@replays/domain/services/baseline';
import { baselineTermsOf } from '@replays/domain/services/baseline-terms';
import { checksSet } from '@replays/domain/services/set-health';
import type { TeamAccess } from '@replays/domain/services/team-access';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
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
      const access = await this.access.forTeam(
        command.teamId,
        command.actor.principal,
      );
      const seen = await this.access.setOn(access, command.setId);

      if (!access.mayPlan) {
        return forbiddenTo('plan');
      }

      const ceiling = Money.ceiling(
        command.ceiling.amount,
        command.ceiling.currency,
      );

      await this.stations.stillThere(seen);

      const requested =
        command.candidate === LIVE
          ? null
          : await this.proposed(access, seen, command.candidate);
      const liveScoring = await this.snapshots.scoringOf(seen);
      const wantedBefore = needsBaseline(
        seen,
        await this.replays.ofSet(seen.id),
        liveScoring,
        command.repeats,
      );
      const live =
        !requested || wantedBefore ? await this.snapshots.taken(seen) : null;
      const candidate = requested ?? (live as Candidate);
      const id = ReplayId.of(this.ids.generate());
      const baselineId = ReplayId.of(this.ids.generate());

      const started = await this.withLiveSnapshot(
        live,
        requested === null,
        () =>
          this.transaction.inTransaction(async () => {
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

            if (needed && requested && !live) {
              throw new ReplaySetBaselineMovedError(set.id.value);
            }

            if (
              requested &&
              !(await this.candidates.lockedForUse(requested.id))
            ) {
              throw new UnknownCandidateError(requested.id.value);
            }

            const asBaseline = needed && !requested;
            const baselineTerms =
              needed && live
                ? baselineTermsOf(
                    checksSet(
                      set,
                      setReplays,
                      await this.candidates.findMany(
                        setReplays.map((each) => each.candidateId),
                      ),
                      live.fingerprint,
                    ),
                    command.repeats,
                    ceiling,
                  )
                : null;
            const wanting =
              requested && live && baselineTerms
                ? { id: baselineId, candidate: live, ...baselineTerms }
                : null;
            const terms =
              asBaseline && baselineTerms
                ? baselineTerms
                : { calibration: false, repeats: command.repeats, ceiling };

            await this.replays.add(
              Replay.start({
                id,
                set,
                candidate,
                baseline: asBaseline,
                ceiling: terms.ceiling,
                repeats: terms.repeats,
                calibration: terms.calibration,
                pairwiseReferenceId: asBaseline
                  ? null
                  : (wanting?.id ??
                    currentBaselineFor(
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

            return {
              asBaseline,
              wanted: wanting !== null,
              ceiling: terms.ceiling,
              baselineCeiling: baselineTerms?.ceiling ?? ceiling,
            };
          }),
      );

      const spend = {
        amount: started.ceiling.amount,
        currency: started.ceiling.currency,
      };
      const baselineSpend = {
        amount: started.baselineCeiling.amount,
        currency: started.baselineCeiling.currency,
      };

      return {
        outcome: 'started',
        id: id.value,
        ceiling: spend,
        baseline: started.asBaseline
          ? { id: id.value, ceiling: spend, status: 'started' }
          : started.wanted
            ? {
                id: baselineId.value,
                ceiling: baselineSpend,
                status: 'starting',
              }
            : null,
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async withLiveSnapshot<T extends { wanted: boolean }>(
    live: Candidate | null,
    replaysLive: boolean,
    start: () => Promise<T>,
  ): Promise<T> {
    let started: T;

    try {
      started = await start();
    } catch (error) {
      await this.snapshots.release(live);
      throw error;
    }

    if (!replaysLive && !started.wanted) {
      await this.snapshots.release(live);
    }

    return started;
  }

  private async proposed(
    access: TeamAccess,
    set: ReplaySet,
    candidateId: string,
  ): Promise<Candidate> {
    const candidate = await this.candidates.find(CandidateId.of(candidateId));

    if (
      !candidate ||
      !access.sees(candidate.station) ||
      !candidate.isFor(set.station.stationId)
    ) {
      throw new UnknownCandidateError(candidateId);
    }

    return candidate;
  }
}
