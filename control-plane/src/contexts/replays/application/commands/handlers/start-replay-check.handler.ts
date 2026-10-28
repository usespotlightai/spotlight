import type { StartReplayCheckCommand } from '@replays/application/commands/start-replay-check.command';
import type { ReplayCheckStartedOutcome } from '@replays/application/dto/replay-outcomes.dto';
import type { HashPort } from '@replays/application/ports/hash.port';
import type { PeoplePort } from '@replays/application/ports/people.port';
import type {
  LiveConfig,
  StationView,
  WorkPort,
} from '@replays/application/ports/work.port';
import type { CheckEvaluations } from '@replays/application/services/check-evaluations.service';
import type { LiveSnapshots } from '@replays/application/services/live-snapshots.service';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import { ReplayCheck } from '@replays/domain/aggregates/replay-check.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import { NoReplaySetError } from '@replays/domain/exceptions/no-replay-set.error';
import { ReplayCheckUnconfiguredError } from '@replays/domain/exceptions/replay-check-unconfigured.error';
import { ReplaySetEmptyError } from '@replays/domain/exceptions/replay-set-empty.error';
import { UnknownReplaySetError } from '@replays/domain/exceptions/unknown-replay-set.error';
import { UnknownStationError } from '@replays/domain/exceptions/unknown-station.error';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { ReplayCheckRepository } from '@replays/domain/repositories/replay-check.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import {
  currentBaselineFor,
  needsBaseline,
} from '@replays/domain/services/baseline';
import {
  type ScoringField,
  scoredLive,
} from '@replays/domain/services/live-scoring';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { PlannedLine } from '@replays/domain/value-objects/planned-line.vo';
import { PlannedReference } from '@replays/domain/value-objects/planned-reference.vo';
import { ReplayCheckId } from '@replays/domain/value-objects/replay-check-id.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplayThreshold } from '@replays/domain/value-objects/replay-threshold.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationPath } from '@replays/domain/value-objects/station-path.vo';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { IdempotentCreatesPort } from '@shared-kernel/application/ports/idempotent-creates.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { createIdempotently } from '@shared-kernel/application/services/create-idempotently';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { IdempotencyKey } from '@shared-kernel/domain/value-objects/idempotency-key.vo';

class CheckRejectedError extends Error {
  constructor(readonly problems: readonly ConfigurationProblem[]) {
    super('Planned station is invalid.');
    this.name = 'CheckRejectedError';
  }
}

class NothingToReplayError extends Error {
  constructor(readonly scoringPinnedToLive: readonly ScoringField[]) {
    super('Planned station runs the same as the live one.');
    this.name = 'NothingToReplayError';
  }
}

interface Gated {
  readonly station: StationView;
  readonly address: StationPath;
  readonly live: LiveConfig;
  readonly threshold: ReplayThreshold;
  readonly set: ReplaySet;
}

interface Planned {
  readonly station: unknown;
  readonly line: PlannedLine | null;
  readonly reference: PlannedReference;
  readonly repeats: number;
}

export class StartReplayCheckHandler
  implements
    CommandHandlerPort<StartReplayCheckCommand, ReplayCheckStartedOutcome>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly people: PeoplePort,
    private readonly work: WorkPort,
    private readonly snapshots: LiveSnapshots,
    private readonly evaluations: CheckEvaluations,
    private readonly candidates: CandidateRepository,
    private readonly sets: ReplaySetRepository,
    private readonly replays: ReplayRepository,
    private readonly checks: ReplayCheckRepository,
    private readonly creates: IdempotentCreatesPort,
    private readonly hash: HashPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
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
      let reused = false;

      try {
        const created = await this.transaction.inTransaction(() =>
          createIdempotently(
            this.creates,
            {
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
            },
            async () => {
              const started = await this.started(
                await this.gated(station),
                planned,
                ChangeActor.of(command.actor, station.workspaceId),
              );

              reused = started.reused;

              return started.id;
            },
          ),
        );

        return created.outcome === 'created' && reused && !created.replayed
          ? { outcome: 'reused', id: created.id }
          : created;
      } catch (error) {
        if (error instanceof CheckRejectedError) {
          return { outcome: 'invalid', problems: error.problems };
        }
        if (error instanceof NothingToReplayError) {
          return {
            outcome: 'unchanged',
            scoringPinnedToLive: error.scoringPinnedToLive,
          };
        }

        throw error;
      }
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async gated(station: StationView): Promise<Gated> {
    const live = await this.work.live(station.lineId, station.stationId);
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

  private async started(
    gated: Gated,
    planned: Planned,
    by: ChangeActor,
  ): Promise<{ readonly id: string; readonly reused: boolean }> {
    const { station, live, threshold } = gated;
    const scored = scoredLive(planned.station, live.block);
    const validated = await this.work.validate(
      station.lineId,
      station.stationId,
      scored.block,
      planned.line,
    );

    if (!validated) {
      throw new UnknownStationError(station.key);
    }
    if (!validated.ok) {
      throw new CheckRejectedError(validated.problems);
    }
    if (validated.hashes.runsAs(validated.liveHashes)) {
      throw new NothingToReplayError(scored.scoringPinnedToLive);
    }

    const set = await this.sets.locked(gated.set.id);

    if (!set) {
      throw new UnknownReplaySetError(gated.set.id.value);
    }

    set.stillAtItsStation();

    const setEntries = this.hash.sha256(
      set.runs
        .map((each) => each.value)
        .sort()
        .join('\n'),
    );
    const earlier = await this.checks.matching(
      station.stationId,
      validated.hashes,
      validated.liveHashes,
    );

    for (const each of [...earlier].reverse()) {
      const { evaluation } = await this.evaluations.of(each);

      if (
        each.reusableFor(
          set,
          setEntries,
          threshold,
          planned.repeats,
          evaluation.result,
        )
      ) {
        return { id: each.id.value, reused: true };
      }
    }

    const at = this.clock.now();
    const candidate = Candidate.plan({
      id: CandidateId.of(this.ids.generate()),
      station,
      address: gated.address,
      block: StationBlock.of(scored.block),
      fingerprint: validated.fingerprint,
      hashes: validated.hashes,
      scoring: validated.scoring,
      changedFrom: validated.changedFrom,
      reference: planned.reference,
      line: planned.line,
      at,
    });
    const setReplays = await this.replays.ofSet(set.id);
    const wanting = needsBaseline(
      set,
      setReplays,
      validated.liveHashes.scoring,
      planned.repeats,
    )
      ? {
          id: ReplayId.of(this.ids.generate()),
          candidate: await this.snapshots.taken(set),
          ceiling: threshold.ceiling,
          repeats: planned.repeats,
          calibration: false,
        }
      : null;
    const replayId = ReplayId.of(this.ids.generate());

    await this.candidates.add(candidate);
    await this.replays.add(
      Replay.start({
        id: replayId,
        set,
        candidate,
        baseline: false,
        ceiling: threshold.ceiling,
        unpricedRate: threshold.unpricedRunIn(
          set.entries.length * planned.repeats,
        ),
        repeats: planned.repeats,
        pairwiseReferenceId: wanting
          ? wanting.id
          : (currentBaselineFor(
              set,
              setReplays,
              validated.liveHashes.scoring,
              planned.repeats,
            )?.id ?? null),
        at,
        by,
        wanting,
      }),
    );

    const check = ReplayCheck.start({
      id: ReplayCheckId.of(this.ids.generate()),
      station: set.station,
      stationKey: station.key,
      setId: set.id,
      setEntries,
      attempt: Math.max(0, ...earlier.map((each) => each.attempt)) + 1,
      candidateId: candidate.id,
      replayId,
      reference: planned.reference,
      liveFingerprint: validated.changedFrom.from,
      candidateFingerprint: validated.fingerprint,
      liveHashes: validated.liveHashes,
      candidateHashes: validated.hashes,
      threshold,
      repeats: planned.repeats,
      scoringPinnedToLive: scored.scoringPinnedToLive,
      createdAt: at,
      by,
    });

    await this.checks.add(check);

    return { id: check.id.value, reused: false };
  }
}
