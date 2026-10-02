import type { StartReplayCommand } from '@replays/application/commands/start-replay.command';
import type { ReplayStarted } from '@replays/application/dto/replay-outcomes.dto';
import type { PeoplePort } from '@replays/application/ports/people.port';
import type { WorkPort } from '@replays/application/ports/work.port';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import type { SetStations } from '@replays/application/services/set-stations.service';
import { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import { ReplaySetBaselineMovedError } from '@replays/domain/exceptions/replay-set-baseline-moved.error';
import { UnknownCandidateError } from '@replays/domain/exceptions/unknown-candidate.error';
import { UnknownReplaySetError } from '@replays/domain/exceptions/unknown-replay-set.error';
import { UnknownStationError } from '@replays/domain/exceptions/unknown-station.error';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import { needsBaseline } from '@replays/domain/services/baseline';
import type { ReplaysClearance } from '@replays/domain/services/replays-clearance';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { StationAddress } from '@replays/domain/value-objects/station-address.vo';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

const LIVE = 'live';

export class StartReplayHandler
  implements CommandHandlerPort<StartReplayCommand, ReplayStarted>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly people: PeoplePort,
    private readonly work: WorkPort,
    private readonly candidates: CandidateRepository,
    private readonly sets: ReplaySetRepository,
    private readonly replays: ReplayRepository,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
    private readonly stations: SetStations,
    private readonly logger: LoggerPort,
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
      const wantedBefore = needsBaseline(
        seen,
        await this.replays.ofSet(seen.id),
      );
      const live = !asked || wantedBefore ? await this.live(seen) : null;
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

            const needed = needsBaseline(set, await this.replays.ofSet(set.id));

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
      await this.letGoOf(live);
      throw error;
    }

    if (!replaysLive && !started.wanted) {
      await this.letGoOf(live);
    }

    return started;
  }

  private async letGoOf(live: Candidate | null): Promise<void> {
    if (!live) {
      return;
    }

    try {
      await this.transaction.run(() => this.candidates.save(live.abandoned()));
    } catch (error) {
      this.logger.warn(
        { candidateId: live.id.value, error },
        'A live snapshot no replay used could not be let go of; it stays unused',
      );
    }
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

  private async live(set: ReplaySet): Promise<Candidate> {
    const { lineId, stationId } = set.station;
    const config = await this.work.live(lineId, stationId);

    if (!config) {
      throw new UnknownStationError(stationId);
    }

    const teamKey = await this.people.teamKey(set.teamId);
    const address = teamKey
      ? StationAddress.of(teamKey, config.lineKey, config.block.key)
      : null;

    if (!address) {
      throw new UnknownStationError(stationId);
    }

    const live = Candidate.live({
      id: CandidateId.of(this.ids.generate()),
      station: set.station,
      address,
      block: config.block,
      fingerprint: config.fingerprint,
      scoring: config.scoring,
      at: this.clock.now(),
    });

    await this.candidates.add(live);

    return live;
  }
}
