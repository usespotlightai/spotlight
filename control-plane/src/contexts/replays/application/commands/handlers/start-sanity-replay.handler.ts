import type { StartSanityReplayCommand } from '@replays/application/commands/start-sanity-replay.command';
import type { SanityReplayStarted } from '@replays/application/dto/replay-outcomes.dto';
import type { PeoplePort } from '@replays/application/ports/people.port';
import type { WorkPort } from '@replays/application/ports/work.port';
import type { LiveSnapshots } from '@replays/application/services/live-snapshots.service';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import type { SetStations } from '@replays/application/services/set-stations.service';
import { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import { ReplaySetBaselineMovedError } from '@replays/domain/exceptions/replay-set-baseline-moved.error';
import { UnknownReplaySetError } from '@replays/domain/exceptions/unknown-replay-set.error';
import { UnknownStationError } from '@replays/domain/exceptions/unknown-station.error';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import { needsBaseline } from '@replays/domain/services/baseline';
import { comparableLiveOf } from '@replays/domain/services/set-health';
import {
  strongerBlockOf,
  strongerProblemsOf,
} from '@replays/domain/services/stronger-model';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { StationAddress } from '@replays/domain/value-objects/station-address.vo';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

const textOf = (held: unknown): string =>
  typeof held === 'string' ? held : '';

export class StartSanityReplayHandler
  implements CommandHandlerPort<StartSanityReplayCommand, SanityReplayStarted>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly people: PeoplePort,
    private readonly work: WorkPort,
    private readonly snapshots: LiveSnapshots,
    private readonly candidates: CandidateRepository,
    private readonly sets: ReplaySetRepository,
    private readonly replays: ReplayRepository,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
    private readonly stations: SetStations,
  ) {}

  async execute(
    command: StartSanityReplayCommand,
  ): Promise<SanityReplayStarted> {
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

      const { lineId, stationId } = seen.station;
      const live = await this.work.live(lineId, stationId);

      if (!live) {
        throw new UnknownStationError(stationId);
      }

      const problems = strongerProblemsOf(
        live.block,
        command,
        await this.work.harnessOffer(
          seen.workspaceId,
          textOf(live.block.value.harness),
        ),
      );

      if (problems.length > 0) {
        return {
          outcome: 'invalid',
          problems: problems.map((each) =>
            ConfigurationProblem.of({
              path: '',
              at: FieldPath.of([each.field]),
              reason: each.reason,
            }),
          ),
        };
      }

      const block = strongerBlockOf(live.block, command);
      const examined = await this.work.examine(lineId, stationId, block.value);
      const teamKey = await this.people.teamKey(seen.teamId);
      const address =
        teamKey && StationAddress.of(teamKey, live.lineKey, live.block.key);

      if (!examined || !address) {
        throw new UnknownStationError(stationId);
      }
      if (!examined.ok) {
        return { outcome: 'invalid', problems: examined.problems };
      }

      const at = this.clock.now();
      const stronger = Candidate.sanity({
        id: CandidateId.of(this.ids.generate()),
        station: seen.station,
        address,
        block: examined.block,
        fingerprint: examined.fingerprint,
        digests: examined.digests,
        scoring: examined.scoring,
        changedFrom: examined.changedFrom,
        at,
      });
      const snapshot = (await this.comparableIn(
        seen,
        live.fingerprint,
        command.repeats,
      ))
        ? null
        : await this.snapshots.taken(seen);
      const id = ReplayId.of(this.ids.generate());
      const comparisonId = ReplayId.of(this.ids.generate());
      let compared: boolean;

      try {
        compared = await this.transaction.run(async () => {
          const set = await this.sets.locked(seen.id);

          if (!set) {
            throw new UnknownReplaySetError(command.setId);
          }

          const comparable = await this.comparableIn(
            set,
            live.fingerprint,
            command.repeats,
          );

          if (!comparable && !snapshot) {
            throw new ReplaySetBaselineMovedError(set.id.value);
          }

          const by = Attribution.of(command.actor, set.workspaceId);

          await this.candidates.add(stronger);
          await this.replays.add(
            Replay.started({
              id,
              set,
              candidate: stronger,
              baseline: false,
              ceiling,
              repeats: command.repeats,
              comparedWith: comparable?.id ?? comparisonId,
              pairsWith: comparable?.id ?? comparisonId,
              at,
              by,
            }),
          );

          if (comparable || !snapshot) {
            return false;
          }

          await this.replays.add(
            Replay.started({
              id: comparisonId,
              set,
              candidate: snapshot,
              baseline: await this.wantsBaseline(set, command.repeats),
              ceiling,
              repeats: command.repeats,
              at,
              by,
            }),
          );

          return true;
        });
      } catch (error) {
        await this.snapshots.letGo(snapshot);
        throw error;
      }

      if (!compared) {
        await this.snapshots.letGo(snapshot);
      }

      const spend = { amount: ceiling.amount, currency: ceiling.currency };

      return {
        outcome: 'started',
        id: id.value,
        candidateId: stronger.id.value,
        ceiling: spend,
        comparison: compared
          ? { id: comparisonId.value, ceiling: spend }
          : null,
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }

  private async comparableIn(
    set: ReplaySet,
    fingerprint: StationFingerprint,
    repeats: number,
  ): Promise<Replay | null> {
    const replayed = await this.replays.ofSet(set.id);

    return comparableLiveOf(
      replayed,
      await this.candidates.findMany(replayed.map((each) => each.candidateId)),
      fingerprint,
      repeats,
    );
  }

  private async wantsBaseline(
    set: ReplaySet,
    repeats: number,
  ): Promise<boolean> {
    return needsBaseline(
      set,
      await this.replays.ofSet(set.id),
      await this.snapshots.scoringOf(set),
      repeats,
    );
  }
}
