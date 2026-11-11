import type { StartReplayCheckCommand } from '@replays/application/commands/start-replay-check.command';
import type { ReplayCheckStartedOutcome } from '@replays/application/dto/replay-outcomes.dto';
import type { HashPort } from '@replays/application/ports/hash.port';
import type { StationView } from '@replays/application/ports/lines.port';
import type { PeoplePort } from '@replays/application/ports/people.port';
import type { CheckEvaluations } from '@replays/application/services/check-evaluations.service';
import type { LiveCandidates } from '@replays/application/services/live-candidates.service';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import type { StartCheckReplays } from '@replays/application/services/start-check-replays.service';
import type {
  LiveConfig,
  StationConfigs,
  ValidatedCandidate,
} from '@replays/application/services/station-configs.service';
import { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import { ReplayCheck } from '@replays/domain/aggregates/replay-check.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import { NoReplaySetError } from '@replays/domain/exceptions/no-replay-set.error';
import { ReplayCheckUnconfiguredError } from '@replays/domain/exceptions/replay-check-unconfigured.error';
import { ReplaySetEmptyError } from '@replays/domain/exceptions/replay-set-empty.error';
import { UnknownReplaySetError } from '@replays/domain/exceptions/unknown-replay-set.error';
import { UnknownStationError } from '@replays/domain/exceptions/unknown-station.error';
import type { ReplayCheckRepository } from '@replays/domain/repositories/replay-check.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import {
  type ScoredLive,
  type ScoringField,
  scoredLive,
} from '@replays/domain/services/live-scoring';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CheckedChange } from '@replays/domain/value-objects/checked-change.vo';
import { PlannedLine } from '@replays/domain/value-objects/planned-line.vo';
import { PlannedReference } from '@replays/domain/value-objects/planned-reference.vo';
import { ReplayCheckId } from '@replays/domain/value-objects/replay-check-id.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplayThreshold } from '@replays/domain/value-objects/replay-threshold.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationPath } from '@replays/domain/value-objects/station-path.vo';
import {
  forbiddenTo,
  type Invalid,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type {
  IdempotentCreate,
  IdempotentCreatesPort,
} from '@shared-kernel/application/ports/idempotent-creates.port';
import type { IdempotentLookupsPort } from '@shared-kernel/application/ports/idempotent-lookups.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import {
  createIdempotently,
  lookupIdempotentCreate,
} from '@shared-kernel/application/services/create-idempotently';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { IdempotencyKey } from '@shared-kernel/domain/value-objects/idempotency-key.vo';

interface Gated {
  readonly station: StationView;
  readonly address: StationPath;
  readonly live: LiveConfig;
  readonly threshold: ReplayThreshold;
  readonly set: ReplaySet;
}

interface Prepared {
  readonly scored: ScoredLive;
  readonly validated: Extract<ValidatedCandidate, { ok: true }>;
}

type Unprepared =
  | Invalid
  | {
      readonly outcome: 'unchanged';
      readonly scoringPinnedToLive: readonly ScoringField[];
    };

interface Planned {
  readonly station: unknown;
  readonly line: PlannedLine | null;
  readonly reference: PlannedReference;
  readonly repeats: number;
}

export class StartReplayCheckHandler implements CommandHandlerPort<
  StartReplayCheckCommand,
  ReplayCheckStartedOutcome
> {
  constructor(
    private readonly access: ReplaysAccess,
    private readonly people: PeoplePort,
    private readonly configs: StationConfigs,
    private readonly snapshots: LiveCandidates,
    private readonly replaying: StartCheckReplays,
    private readonly evaluations: CheckEvaluations,
    private readonly sets: ReplaySetRepository,
    private readonly checks: ReplayCheckRepository,
    private readonly creates: IdempotentCreatesPort,
    private readonly lookups: IdempotentLookupsPort,
    private readonly hash: HashPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(
    command: StartReplayCheckCommand,
  ): Promise<ReplayCheckStartedOutcome> {
    try {
      const access = await this.access.forTeam(
        command.teamId,
        command.actor.principal,
      );
      const station = await this.access.keyedStationOn(
        access,
        command.change.lineId,
        command.change.stationKey,
      );

      if (!access.mayPlan) {
        return forbiddenTo('plan');
      }

      const planned: Planned = {
        station: command.change.station,
        line:
          command.change.line === undefined || command.change.line === null
            ? null
            : PlannedLine.of(command.change.line),
        reference: PlannedReference.of(command.change.reference),
        repeats: command.repeats,
      };
      const create: IdempotentCreate = {
        by: command.actor.principal.toString(),
        key: IdempotencyKey.of(command.idempotencyKey),
        request: {
          replayCheck: 'start',
          teamId: command.teamId,
          lineId: command.change.lineId,
          stationKey: command.change.stationKey,
          station: command.change.station,
          line: planned.line?.value ?? null,
          reference: {
            commit: planned.reference.commit,
            pullRequest: planned.reference.pullRequest,
          },
          repeats: planned.repeats,
        },
      };
      const earlier = await lookupIdempotentCreate(this.lookups, create);

      if (earlier) {
        return earlier;
      }

      return await this.startedOrReused(
        create,
        await this.gated(station),
        planned,
        ChangeActor.of(command.actor, station.workspaceId),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async startedOrReused(
    create: IdempotentCreate,
    gated: Gated,
    planned: Planned,
    by: ChangeActor,
  ): Promise<ReplayCheckStartedOutcome> {
    const prepared = await this.prepared(gated, planned);

    if ('outcome' in prepared) {
      return prepared;
    }

    const reusable = await this.reusable(gated, prepared, planned);
    const candidate = reusable
      ? null
      : this.candidateOf(gated, prepared, planned);
    let started = false;

    if (candidate) {
      await this.snapshots.kept(candidate);
    }

    try {
      const created = await this.transaction.inTransaction(() =>
        createIdempotently(this.creates, create, async () => {
          if (!candidate) {
            return reusable?.value ?? '';
          }

          const id = await this.started(gated, prepared, planned, {
            candidate,
            by,
          });

          started = true;

          return id;
        }),
      );

      if (candidate && !started) {
        await this.snapshots.release(candidate);
      }
      if (started && created.outcome === 'created') {
        await this.replayStarted(ReplayCheckId.of(created.id), by);
      }

      return created.outcome === 'created' && reusable && !created.replayed
        ? { outcome: 'reused', id: created.id }
        : created;
    } catch (error) {
      if (candidate) {
        await this.snapshots.release(candidate);
      }
      throw error;
    }
  }

  private async replayStarted(
    checkId: ReplayCheckId,
    by: ChangeActor,
  ): Promise<void> {
    try {
      await this.replaying.replayOf(checkId, by);
    } catch (error) {
      this.logger.warn(
        { checkId: checkId.value, error },
        'The replay of a new check could not start yet; Spotlight starts it from the check’s start event',
      );
    }
  }

  private async gated(station: StationView): Promise<Gated> {
    const live = await this.configs.live(station.lineId, station.stationId);
    const teamKey = await this.people.teamKey(station.teamId);
    const set = await this.sets.ofStation(station.stationId);
    const address = teamKey
      ? StationPath.of(teamKey, station.lineKey, station.key)
      : null;

    if (!live || !address) {
      throw new UnknownStationError(station.key);
    }
    if (!live.threshold) {
      throw new ReplayCheckUnconfiguredError(station.lineKey);
    }

    if (!set || set.isAtGoneStation) {
      throw new NoReplaySetError(station.key);
    }
    if (set.entries.length === 0) {
      throw new ReplaySetEmptyError(station.key);
    }

    return { station, address, live, threshold: live.threshold, set };
  }

  private async prepared(
    gated: Gated,
    planned: Planned,
  ): Promise<Prepared | Unprepared> {
    const { station, live } = gated;
    const scored = scoredLive(planned.station, live.block);
    const validated = await this.configs.validate(
      station.lineId,
      station.stationId,
      scored.block,
      planned.line,
    );

    if (!validated) {
      throw new UnknownStationError(station.key);
    }
    if (!validated.ok) {
      return { outcome: 'invalid', problems: validated.problems };
    }
    if (validated.hashes.runsAs(validated.liveHashes)) {
      return {
        outcome: 'unchanged',
        scoringPinnedToLive: scored.scoringPinnedToLive,
      };
    }

    return { scored, validated };
  }

  private async reusable(
    gated: Gated,
    { validated }: Prepared,
    planned: Planned,
  ): Promise<ReplayCheckId | null> {
    const { set, threshold } = gated;
    const setEntries = set.digestOfEntries((text) => this.hash.sha256(text));
    const change = CheckedChange.of(validated.hashes, validated.liveHashes);
    const earlier = await this.checks.ofChange(gated.station.stationId, change);

    for (const each of [...earlier].reverse()) {
      const { evaluation } = await this.evaluations.of(each);

      if (
        each.reusableFor(
          change,
          set.id,
          setEntries,
          threshold,
          planned.repeats,
          evaluation.result,
          planned.reference,
        )
      ) {
        return each.id;
      }
    }

    return null;
  }

  private candidateOf(
    gated: Gated,
    { scored, validated }: Prepared,
    planned: Planned,
  ): Candidate {
    return Candidate.plan({
      id: CandidateId.of(this.ids.generate()),
      station: gated.station,
      address: gated.address,
      block: StationBlock.of(scored.block),
      fingerprint: validated.fingerprint,
      hashes: validated.hashes,
      scoring: validated.scoring,
      changedFrom: validated.changedFrom,
      reference: planned.reference,
      line: planned.line,
      at: this.clock.now(),
    });
  }

  private async started(
    gated: Gated,
    { scored, validated }: Prepared,
    planned: Planned,
    made: { readonly candidate: Candidate; readonly by: ChangeActor },
  ): Promise<string> {
    const set = await this.sets.locked(gated.set.id);

    if (!set) {
      throw new UnknownReplaySetError(gated.set.id.value);
    }

    set.stillAtItsStation();

    const change = CheckedChange.of(validated.hashes, validated.liveHashes);
    const earlier = await this.checks.ofChange(gated.station.stationId, change);
    const check = ReplayCheck.start({
      id: ReplayCheckId.of(this.ids.generate()),
      station: set.station,
      stationKey: gated.station.key,
      setId: set.id,
      setEntries: set.digestOfEntries((text) => this.hash.sha256(text)),
      attempt: ReplayCheck.nextAttemptAfter(earlier, change),
      candidateId: made.candidate.id,
      replayId: ReplayId.of(this.ids.generate()),
      reference: planned.reference,
      liveFingerprint: validated.changedFrom.from,
      candidateFingerprint: validated.fingerprint,
      liveHashes: validated.liveHashes,
      candidateHashes: validated.hashes,
      threshold: gated.threshold,
      repeats: planned.repeats,
      scoringPinnedToLive: scored.scoringPinnedToLive,
      createdAt: this.clock.now(),
      by: made.by,
    });

    await this.checks.add(check);

    return check.id.value;
  }
}
